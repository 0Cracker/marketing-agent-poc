// Explicit local development simulator. Never performs network or paid model calls.
import {chatValue} from '../../shared/roas/roas-chat.mjs';

const mockCandidate=Object.freeze({id:'local-mock',provider:'mock',model:'local-data-only',
  transport:'in_process',billingBucket:'none',eligible:true});

export function createMockProviderPool() {
  return {
    providerStatus:()=>[{...mockCandidate,configured:true,reason:'mock_only'}],
    eligibleCandidates:()=>[mockCandidate],
    async invokeOnce({instruction,input,format}) {
      if(format==='jev') {
        const question=input.state.user_question;
        const grouped=/캠페인별|기기별|타깃별/u.test(question);
        const dimension=question.includes('기기별')?'device':question.includes('타깃별')?'audienceId':'campaign';
        const route=/분석|원인|왜/u.test(question)?'deep':'quick';
        const explicit=/ROAS/iu.test(question);
        const components=explicit&&/산식|분자|분모/u.test(question);
        const yes=new Set(['need_overview',...(grouped?['need_metric_breakdown','breakdown_roas_'+dimension]:[])]);
        if(components){yes.add('need_metric_components');yes.add('components_roas');}
        if(explicit&&(grouped||components))yes.add('metric_roas');
        return {output:{answers:Object.fromEntries(Object.entries(input.questions).map(([id,q])=>{
          if(q.type==='noul')return [id,{type:'noul',noul:yes.has(id)?1:0}];
          const choice=id==='route'?route:explicit?'catalog':'general_roas';
          return [id,{type:'choice',choice,probabilities:Object.fromEntries(Object.keys(q.criteria)
            .map(key=>[key,Number(key===choice)])),confidence:1}];
        }))}};
      }
      if(instruction.includes('Choose the FIRST additional data tools'))
        return {output:{toolCalls:[]},actualModel:mockCandidate.model};
      if(instruction.includes('You decide follow-up tools'))
        return {output:{decision:'gemini_sufficient'},actualModel:mockCandidate.model};
      const overview=input.results.find(item=>item.name==='overview');
      const period=overview?.result?.periods?.find(item=>item.id==='current');
      if(typeof period?.display?.roas!=='string')
        throw Object.assign(Error('mock_source_unavailable'),{code:'model_protocol'});
      if(format==='markdown') {
        const detail=input.results.find(item=>['metric_detail','metric_breakdown'].includes(item.name))?.result;
        const components=input.results.find(item=>item.name==='metric_components')?.result;
        const current=components?.periods?.find(item=>item.id==='current');
        const rows=(detail?.groups||[]).filter(group=>Number.isFinite(group.current?.value)).map(group=>
          '| '+group.label.replaceAll('|','\\|')+' | '+chatValue(group.current.value,detail.metric)+' |');
        return {output:'현재 ROAS는 **'+period.display.roas+'**입니다.'+
          (current?'\n\nROAS는 구매 매출 '+current.numerator+'원 ÷ 집행비 '+current.denominator+'원으로 계산합니다.':'')+
          (rows.length?'\n\n| 분석 단위 | 현재 ROAS |\n| --- | --- |\n'+rows.join('\n'):'')};
      }
      throw Object.assign(Error('unsupported_mock_format'),{code:'model_protocol'});
    }
  };
}
