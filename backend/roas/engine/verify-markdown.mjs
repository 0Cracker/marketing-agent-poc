import {metrics} from '../tools/metrics.mjs';

const citation=/\[(EV-[^\]\r\n]+)\]/gu;
const measuredNumber=/(?<![\p{L}\d])([+−-]?\d[\d,]*(?:\.\d+)?)\s*(%포인트|퍼센트포인트|%p|%|원|건|회|점)/gu;
const canonicalUnit=unit=>['%포인트','퍼센트포인트'].includes(unit)?'%p':unit;
const aliases={roas:/\bROAS\b/iu,cvr:/\bCVR\b|구매 전환율/iu,cpc:/\bCPC\b/iu,cpa:/\bCPA\b/iu,
  aov:/\bAOV\b|객단가/iu,adCtr:/\bCTR\b/iu,contentClickRate:/콘텐츠 링크 클릭률/u,
  spend:/\bspend\b|광고비|집행비|지출/iu,revenue:/\brevenue\b|매출/iu,orders:/주문\s*(?:수|건수)/u,clicks:/클릭\s*(?:수|횟수)/u,
  adCpm:/광고\s*CPM/iu,contentCpm:/조회\s*1,?000회당 비용/u,paymentFailureRate:/결제 실패율/u};
const metricMentions=text=>Object.keys(aliases).filter(key=>aliases[key].test(text));

function measurements(results) {
  const issued=new Map();
  function visit(node,context={},depth=0) {
    if(!node||typeof node!=='object'||depth>8)return;
    if(Array.isArray(node)) {
      for(const item of node)visit(item,context,depth+1);
      return;
    }
    const metric=node.metric||context.metric;
    const period=node.periodId||(['baseline','current'].includes(node.id)?node.id:context.period);
    const series=String(node.key??node.date??context.series??'all');
    const evidenceId=node.evidenceId||(node.categoryId&&node.evidenceIds?.length===1?node.evidenceIds[0]:undefined);
    if(evidenceId) {
      const values=[];
      const add=(value,unit,id)=>{
        if(Number.isFinite(value))values.push({value,unit,metric:id,period,series});
      };
      const addMetric=(id,measure)=>{
        if(!Object.hasOwn(metrics,id)||!measure)return;
        const def=metrics[id];
        if(Number.isFinite(measure.value))add(def.rate?measure.value*100:measure.value,def.unit,id);
        const units={spend:'원',revenue:'원',orders:'건',clicks:'회',impressions:'회'};
        if(units[def.numeratorField])add(measure.numerator,units[def.numeratorField],def.numeratorField);
        if(units[def.denominatorField])add(measure.denominator,units[def.denominatorField],def.denominatorField);
      };
      if(metric)addMetric(metric,node);
      for(const [id,component] of Object.entries(node.components||{}))addMetric(id,component);
      add(node.count,'건','count');
      add(node.meanRating,'점','rating');
      add(node.rating,'점','rating');
      add(node.percent,'%','review_share');
      if(!issued.has(evidenceId)||values.length)issued.set(evidenceId,values);
    }
    for(const key of ['periods','days','groups','baseline','current','records','reviews','categories','experiences','items','summary']) {
      const child=node[key];
      if(key==='summary'&&child&&node.evidenceId)
        visit({...child,evidenceId:node.evidenceId},{metric,period,series},depth+1);
      else visit(child,{metric,period:['baseline','current'].includes(key)?key:period,series},depth+1);
    }
  }
  for(const {result} of results)visit(result);
  return issued;
}

function includesNumber(values,token,unit) {
  const number=Number(token.replaceAll(',','').replace('−','-'));
  const tolerance=0.5*10**-(token.split('.')[1]?.length||0)+1e-9;
  const near=(value,expectedUnit)=>expectedUnit===unit&&Math.abs(value-number)<=tolerance;
  if(values.some(row=>near(row.value,row.unit)))return true;
  for(const before of values.filter(row=>row.period==='baseline')) {
    for(const after of values.filter(row=>row.period==='current'&&row.metric===before.metric&&row.series===before.series)) {
      const delta=after.value-before.value;
      if(near(delta,before.unit==='%'?'%p':before.unit)||near(Math.abs(delta),before.unit==='%'?'%p':before.unit))return true;
      if(before.value&&(near(delta/before.value*100,'%')||near(Math.abs(delta/before.value*100),'%')))return true;
    }
  }
  return false;
}

export function verifyMarkdownAnswer(answer,toolRuntime,results,limitations=[],check=()=>{}) {
  const fail=(step,code,details)=>{
    check(step,'failed',code,details);
    if(step==='format')check('evidence','skipped');
    if(step!=='numbers')check('numbers','skipped');
    return {status:'withheld',issues:[code]};
  };
  if(typeof answer!=='string'||!answer.trim()||answer.length>20000)return fail('format','invalid_answer');
  // Models may put several real IDs in one bracket. Each ID still needs source validation.
  answer=answer.replace(/\[(EV-[^\]\r\n]+)\]/gu,(whole,group)=>{
    const ids=group.split(/\s*[,，]\s*/u);
    return ids.every(id=>/^EV-[A-Za-z0-9-]+$/u.test(id))?ids.map(id=>'['+id+']').join(' '):whole;
  });
  check('format','passed');
  const evidenceIds=[...new Set([...answer.matchAll(citation)].map(match=>match[1]))];
  if(!evidenceIds.length||evidenceIds.length>100)return fail('evidence','invalid_citations');
  for(let start=0;start<evidenceIds.length;start+=24) {
    if(!toolRuntime.verifyEvidence({evidenceIds:evidenceIds.slice(start,start+24),claims:[]})?.valid)
      return fail('evidence','source_verification_failed');
  }
  check('evidence','passed');
  const indexed=measurements(results);
  const lines=answer.split(/\r?\n/u);
  let headers=[];
  const cells=line=>line.trim().replace(/^\||(?<!\\)\|$/gu,'').split(/(?<!\\)\|/u);
  for(const [index,line] of lines.entries()) {
    if(!line.includes('|'))headers=[];
    else if(lines[index+1]?.includes('|')&&cells(lines[index+1]).every(cell=>/^\s*:?-{3,}:?\s*$/u.test(cell))) {
      headers=cells(line);continue;
    }
    const ids=[...line.matchAll(citation)].map(match=>match[1]);
    if(!ids.length) {
      const mentions=metricMentions(line);
      const tokens=[...line.replace(/1,?000회당 비용/gu,'비용').matchAll(measuredNumber)];
      if(mentions.some(metric=>tokens.some(match=>canonicalUnit(match[2])===metrics[metric].unit||metrics[metric].rate&&canonicalUnit(match[2])==='%p'))&&
          !/목표|가정|예시|권고/u.test(line))return fail('numbers','missing_numeric_citation');
      continue;
    }
    const values=ids.flatMap(id=>indexed.get(id)||[]);
    if(!values.length)continue;
    const entries=headers.length?cells(line):[...line.matchAll(/([\s\S]*?(?:\[EV-[^\]\n]+\]\s*)+)/gu)].map(match=>match[1]);
    for(const [col,entry] of entries.entries()) {
      const localIds=[...entry.matchAll(citation)].map(match=>match[1]);
      const localValues=headers.length?values:localIds.flatMap(id=>indexed.get(id)||[]);
      if(!localValues.length)continue;
      const mentions=metricMentions(headers.length?(headers[col]||'')+' '+entries[0]+' '+entry:entry);
      const scoped=mentions.length===1?localValues.filter(value=>value.metric===mentions[0]):localValues;
      for(const match of entry.replace(citation,'').replace(/1,?000회당 비용/gu,'비용').matchAll(measuredNumber)) {
        const unit=canonicalUnit(match[2]);
        const expected=scoped.some(value=>value.unit===unit)||unit==='%p'&&scoped.some(value=>value.unit==='%');
        if((expected||mentions.length===1&&unit===metrics[mentions[0]].unit)&&!includesNumber(scoped,match[1],unit))
          return fail('numbers','numeric_mismatch','표시값 '+match[1]+unit+', 지표 '+(mentions.join(', ')||'미지정')+
            ', 근거 수치 '+scoped.filter(value=>value.unit===unit).map(value=>value.value.toFixed(4)).slice(0,8).join(', '));
      }
    }
  }
  check('numbers','passed');
  return {status:limitations.length?'partial':'completed',answer:answer.trim(),evidenceIds,limitations};
}
