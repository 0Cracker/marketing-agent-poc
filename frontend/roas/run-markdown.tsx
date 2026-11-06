import type {ReactNode} from 'react';

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
   blocks.push(<div className="wb-table-scroll" key={key}><table><thead><tr>{headers.map((cell,j)=><th key={j} scope="col">{inline(cell)}</th>)}</tr></thead><tbody>
    {rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k}>{inline(cell)}</td>)}</tr>)}
   </tbody></table></div>);continue;
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
