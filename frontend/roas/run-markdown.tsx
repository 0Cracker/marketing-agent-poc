import type {ReactNode} from 'react';
import './run-markdown.css';

function inline(value:string):ReactNode[] {
 return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[EV-[^\]]+\])/u).map((part,index)=>{
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

function Table({headers,rows}:{headers:string[];rows:string[][]}){
 const table=headers.join(' ');
 const numericColumn=headers.map((_,j)=>j>0&&rows.length>0&&rows.every(row=>!row[j]||row[j]==='-'||isNumericCell(row[j])));
 return <div className="wb-run-table"><table><thead><tr>{headers.map((cell,j)=><th key={j} scope="col" className={numericColumn[j]?'is-numeric':undefined}>{inline(cell)}</th>)}</tr></thead><tbody>
  {rows.map((row,j)=><tr key={j}>{row.map((cell,k)=>{
   const tone=k>0?cellTone(cell,headers[k]||'',row[0]||'',table):undefined;
   const className=[numericColumn[k]?'is-numeric':'',tone?'wb-answer-change is-'+tone:''].filter(Boolean).join(' ')||undefined;
   return k===0?<th key={k} scope="row">{inline(cell)}</th>:<td key={k} className={className}>{inline(cell)}</td>;
  })}</tr>)}
 </tbody></table></div>;
}

export function RunMarkdown({answer}:{answer:string}) {
 const lines=answer.split(/\r?\n/u);
 const blocks:ReactNode[]=[];
 for(let i=0;i<lines.length;){
  const line=lines[i],key=i;
  if(!line.trim()){i++;continue;}
  const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+)/u);
  if(heading){
   const Tag=heading[1].length<=2?'h3':heading[1].length===3?'h4':'h5';
   blocks.push(<Tag key={key}>{inline(heading[2])}</Tag>);i++;continue;
  }
  if(line.includes('|')&&separator(lines[i+1]||'')){
   const headers=cells(line),rows:string[][]=[];
   i+=2;
   while(i<lines.length&&lines[i].includes('|')&&cells(lines[i]).length===headers.length)rows.push(cells(lines[i++]));
   blocks.push(<Table key={key} headers={headers} rows={rows}/>);continue;
  }
  const pattern=bullet.test(line)?bullet:numbered.test(line)?numbered:null;
  if(pattern){
   const List=pattern===bullet?'ul':'ol',items:string[]=[];
   while(i<lines.length&&pattern.test(lines[i]))items.push(lines[i++].replace(pattern,''));
   blocks.push(<List key={key}>{items.map((item,j)=><li key={j}>{inline(item)}</li>)}</List>);continue;
  }
  const paragraph=[line];i++;
  while(i<lines.length&&lines[i].trim()&&!/^\s{0,3}#{1,6}\s/u.test(lines[i])&&
    !bullet.test(lines[i])&&!numbered.test(lines[i])&&!separator(lines[i+1]||''))paragraph.push(lines[i++]);
  blocks.push(<p key={key}>{inline(paragraph.join(' '))}</p>);
 }
 return <div className="wb-run-markdown">{blocks}</div>;
}
