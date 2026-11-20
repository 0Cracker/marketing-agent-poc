import {useState} from 'react';
import type {ReactNode} from 'react';
import {X} from 'lucide-react';
import './run-markdown.css';

// 답변 지침의 `[근거: 자료 / 지표 또는 기록 / 대상·기간]` 태그. 본문에는 번호만 두고 내용은 펼쳐서 본다.
const citationPattern=/\[근거:\s*([^\]\n]+)\]/u;
export type Citation={text:string;parts:string[]};
const normalize=(text:string)=>text.trim().replace(/\s+/gu,' ');
export function collectCitations(answer:string):Citation[]{
 const seen=new Map<string,Citation>();
 for(const match of answer.matchAll(new RegExp(citationPattern.source,'gu'))){
  const text=normalize(match[1]);
  if(!seen.has(text))seen.set(text,{text,parts:text.split(/\s+\/\s+/u).map(part=>part.trim()).filter(Boolean)});
 }
 return [...seen.values()];
}
type Cite=(text:string,index:number)=>ReactNode;

function inline(value:string,cite?:Cite):ReactNode[] {
 return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[EV-[^\]]+\]|\[근거:\s*[^\]\n]+\])/u).map((part,index)=>{
  const citation=part.match(citationPattern);
  if(citation&&citation[0]===part)return cite?cite(normalize(citation[1]),index):part;
  if(part.startsWith('**')&&part.endsWith('**'))return <strong key={index}>{part.slice(2,-2)}</strong>;
  if(part.startsWith('*')&&part.endsWith('*'))return <em key={index}>{part.slice(1,-1)}</em>;
  if(part.startsWith('`')&&part.endsWith('`'))return <code key={index}>{part.slice(1,-1)}</code>;
  if(part.startsWith('[EV-')&&part.endsWith(']'))return <code key={index}>{part}</code>;
  return part;
 });
}

const cells=(line:string)=>line.trim().replace(/^\||(?<!\\)\|$/gu,'').split(/(?<!\\)\|/u)
 .map(value=>value.trim().replaceAll('\\|','|'));
const separator=(line:string)=>line.includes('|')&&cells(line).every(value=>/^:?-{3,}:?$/u.test(value));
const bullet=/^\s*[-*]\s+/u;
const numbered=/^\s*\d+\.\s+/u;

// 표 셀의 방향 색은 대시보드 규칙(개선 빨강, 악화 파랑, 방향 없는 지표 회색)을 따른다.
// 지표 이름은 행 이름, 열 제목, 표 전체 제목 순서로 찾는다. 집행비처럼 방향이 없는 지표는 칠하지 않는다.
const lowerBetter=/CPC|CPM|CPA|CAC|실패|오류|이탈|로딩|환불/iu;
const neutralMetric=/집행비|비용|예산|광고비/u;
const higherBetter=/ROAS|매출|주문|CVR|전환|CTR|클릭률|AOV|객단가|노출|클릭|세션|구매|기여/iu;
function orientation(text:string):number|undefined{
 if(lowerBetter.test(text))return -1;
 if(neutralMetric.test(text))return 0;
 if(higherBetter.test(text))return 1;
 return undefined;
}
const signedValue=/^([+\-−])\s*\d[\d,.]*\s*(%p|%|원|건|회|명|배)?$/u;
const numericValue=/^[+\-−]?\s*[\d,.]+\s*(%p|%|원|만 원|억 원|건|회|명|배|ms)?$/u;
export function cellTone(value:string,column:string,row:string,table:string):'positive'|'negative'|'neutral'|undefined{
 const sign=value.trim().match(signedValue)?.[1];
 if(!sign)return undefined;
 if(/^[+\-−]\s*0(\.0+)?\s*(%p|%)?$/u.test(value.trim()))return 'neutral';
 const preference=orientation(row)??orientation(column)??orientation(table)??0;
 if(!preference)return 'neutral';
 return (sign==='+'?1:-1)*preference>0?'positive':'negative';
}
export const isNumericCell=(value:string)=>numericValue.test(value.trim().replace(/^\*\*|\*\*$/gu,''));

function Table({headers,rows,cite}:{headers:string[];rows:string[][];cite?:Cite}){
 const table=headers.join(' ');
 const numericColumn=headers.map((_,j)=>j>0&&rows.length>0&&rows.every(row=>!row[j]||row[j]==='-'||isNumericCell(row[j])));
 return <div className="wb-run-table"><table><thead><tr>{headers.map((cell,j)=><th key={j} scope="col" className={numericColumn[j]?'is-numeric':undefined}>{inline(cell,cite)}</th>)}</tr></thead><tbody>
  {rows.map((row,j)=><tr key={j}>{row.map((cell,k)=>{
   const tone=k>0?cellTone(cell,headers[k]||'',row[0]||'',table):undefined;
   const className=[numericColumn[k]?'is-numeric':'',tone?'wb-answer-change is-'+tone:''].filter(Boolean).join(' ')||undefined;
   return k===0?<th key={k} scope="row">{inline(cell,cite)}</th>:<td key={k} className={className}>{inline(cell,cite)}</td>;
  })}</tr>)}
 </tbody></table></div>;
}

const citationLabels=['자료','지표 또는 기록','대상·기간'];
function CitationDetail({number,citation,onClose}:{number:number;citation:Citation;onClose:()=>void}){
 const fields=citation.parts.length>=3?[citation.parts[0],citation.parts[1],citation.parts.slice(2).join(' / ')]:citation.parts;
 return <aside className="wb-run-cite-detail" aria-label={`근거 ${number}`}>
  <header><span>근거 {number}</span><button type="button" aria-label="근거 닫기" onClick={onClose}><X size={14}/></button></header>
  {fields.length===3?<dl>{fields.map((field,i)=><div key={i}><dt>{citationLabels[i]}</dt><dd>{field}</dd></div>)}</dl>:<p>{citation.text}</p>}
 </aside>;
}

type BlockContext={citeFor:(owner:number)=>Cite;detail:(owner:number)=>ReactNode;badges:boolean};
// 관측 사실과 원인 후보를 구분해 보이도록 원인 후보 문장 앞에 표시를 붙인다.
const hypothesis=/원인 후보|가설|추정/u;
const badged=(text:string,nodes:ReactNode[],on:boolean)=>on&&hypothesis.test(text)?[<span key="badge" className="wb-run-badge">원인 후보</span>,...nodes]:nodes;

function renderBlocks(lines:string[],offset:number,{citeFor,detail,badges}:BlockContext):ReactNode[]{
 const blocks:ReactNode[]=[];
 let block=-1;
 const flush=()=>{if(block>=0){const open=detail(block);if(open)blocks.push(open);}};
 for(let i=0;i<lines.length;){
  const line=lines[i],key=offset+i;
  if(!line.trim()){i++;continue;}
  flush();block=key;
  const cite=citeFor(key);
  const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+)/u);
  if(heading){
   const Tag=heading[1].length<=2?'h3':heading[1].length===3?'h4':'h5';
   blocks.push(<Tag key={key}>{inline(heading[2],cite)}</Tag>);i++;continue;
  }
  if(line.includes('|')&&separator(lines[i+1]||'')){
   const headers=cells(line),rows:string[][]=[];
   i+=2;
   while(i<lines.length&&lines[i].includes('|')&&cells(lines[i]).length===headers.length)rows.push(cells(lines[i++]));
   blocks.push(<Table key={key} headers={headers} rows={rows} cite={cite}/>);continue;
  }
  const pattern=bullet.test(line)?bullet:numbered.test(line)?numbered:null;
  if(pattern){
   const List=pattern===bullet?'ul':'ol',items:string[]=[];
   while(i<lines.length&&pattern.test(lines[i]))items.push(lines[i++].replace(pattern,''));
   blocks.push(<List key={key}>{items.map((item,j)=><li key={j}>{badged(item,inline(item,cite),badges)}</li>)}</List>);continue;
  }
  const paragraph=[line];i++;
  while(i<lines.length&&lines[i].trim()&&!/^\s{0,3}#{1,6}\s/u.test(lines[i])&&
    !bullet.test(lines[i])&&!numbered.test(lines[i])&&!separator(lines[i+1]||''))paragraph.push(lines[i++]);
  const text=paragraph.join(' ');
  // 표 아래처럼 근거 태그만 있는 줄은 본문 문단 대신 작은 출처 줄로 둔다.
  const onlyCitations=!text.replace(new RegExp(citationPattern.source,'gu'),'').trim();
  blocks.push(onlyCitations?<p key={key} className="wb-run-cite-line"><span>근거</span>{inline(text,cite)}</p>:<p key={key}>{badged(text,inline(text,cite),badges)}</p>);
 }
 flush();
 return blocks;
}

// 답변 지침이 정한 Deep 소제목. 이 이름이 하나라도 있으면 예시 답변과 같은 구역 배치로 보여준다.
const sectionKinds={'핵심 결론':'conclusion','판단 근거':'reasoning','추천 액션':'actions','확인이 필요한 점':'limits'} as const;
type SectionKind=typeof sectionKinds[keyof typeof sectionKinds];
type Section={kind:SectionKind|'lead';title?:string;offset:number;lines:string[]};
const sectionHeading=/^\s{0,3}#{1,2}\s+(?:\d+\.\s*)?(핵심 결론|판단 근거|추천 액션|확인이 필요한 점)\s*$/u;
export function splitSections(answer:string):Section[]|null{
 const lines=answer.split(/\r?\n/u),sections:Section[]=[{kind:'lead',offset:0,lines:[]}];
 lines.forEach((line,index)=>{
  const match=line.match(sectionHeading);
  if(match){const title=match[1] as keyof typeof sectionKinds;sections.push({kind:sectionKinds[title],title,offset:index+1,lines:[]});}
  else sections[sections.length-1].lines.push(line);
 });
 if(sections.length===1)return null;
 const lead=sections[0];
 if(!lead.lines.some(line=>line.trim()))return sections.slice(1);
 // 소제목 앞에 쓴 첫 문단은 결론으로 본다. 결론 구역이 따로 있으면 그 앞에 합친다.
 const conclusion=sections.find(section=>section.kind==='conclusion');
 if(conclusion){conclusion.lines=[...lead.lines,'',...conclusion.lines];conclusion.offset=0;return sections.slice(1);}
 return [{kind:'conclusion',title:'핵심 결론',offset:0,lines:lead.lines},...sections.slice(1)];
}

// 결론의 대표 변화(예: "ROAS는 355.8%에서 284.7%로 71.1%p 하락")를 직전 → 현재 칩으로 보여준다.
const changePattern=/([A-Za-z가-힣]+)(?:은|는|이|가)\s+(-?[\d,.]+\s*(?:%|원|건)?)에서\s+(-?[\d,.]+\s*(?:%|원|건)?)(?:으로|로)\s+(?:([\d,.]+\s*(?:%p|%|원|건)?)\s*)?(하락|감소|상승|증가)/u;
export function headlineChange(text:string){
 const match=text.replace(/\*\*/gu,'').match(changePattern);
 if(!match)return null;
 const [,metric,before,after,amount,direction]=match;
 const sign=/하락|감소/u.test(direction)?-1:1,preference=orientation(metric)??0;
 const tone=!preference?'neutral':sign*preference>0?'positive':'negative';
 return {metric,before,after,delta:amount?(sign<0?'−':'+')+amount.trim():undefined,tone};
}

export function RunMarkdown({answer}:{answer:string}) {
 const citations=collectCitations(answer);
 const numberOf=(text:string)=>citations.findIndex(item=>item.text===text)+1;
 const [selected,setSelected]=useState<{block:number;number:number}|null>(null);
 const citeFor=(owner:number):Cite=>(text,index)=>{
  const number=numberOf(text),open=selected?.block===owner&&selected.number===number;
  return <button key={index} type="button" className="wb-run-cite" title={text} aria-label={`근거 ${number}: ${text}`} aria-expanded={open}
   onClick={()=>setSelected(open?null:{block:owner,number})}>{number}</button>;
 };
 const detail=(owner:number)=>selected?.block===owner&&citations[selected.number-1]?
  <CitationDetail key={'cite-'+owner} number={selected.number} citation={citations[selected.number-1]} onClose={()=>setSelected(null)}/>:null;
 const sections=splitSections(answer);
 const sources=citations.length>0&&<details className="wb-run-sources"><summary>참고한 자료 {citations.length}개</summary>
  <ol>{citations.map((citation,i)=><li key={citation.text}><span>{i+1}</span><p>{citation.parts.join(' · ')}</p></li>)}</ol>
 </details>;
 if(!sections)return <div className="wb-run-markdown">{renderBlocks(answer.split(/\r?\n/u),0,{citeFor,detail,badges:true})}{sources}</div>;
 return <div className="wb-run-markdown is-structured">
  {sections.map(section=>{
   const kind=section.kind==='lead'?'conclusion':section.kind;
   const change=kind==='conclusion'?headlineChange(section.lines.join(' ')):null;
   const blocks=renderBlocks(section.lines,section.offset,{citeFor,detail,badges:kind==='reasoning'||kind==='actions'});
   if(!blocks.length)return null;
   return <section key={section.offset+'-'+kind} className={'wb-run-section is-'+kind} aria-label={section.title}>
    {section.title&&<h3 className="wb-run-section-title">{section.title}</h3>}
    {change&&<p className="wb-run-headline"><span>{change.metric}</span><b>{change.before}</b><span aria-hidden="true">→</span>
     <b className={'wb-answer-change is-'+change.tone}>{change.after}</b>{change.delta&&<small className={'wb-answer-change is-'+change.tone}>{change.delta}</small>}</p>}
    {blocks}
   </section>;
  })}
  {sources}
 </div>;
}
