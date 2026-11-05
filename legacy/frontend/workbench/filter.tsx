import {Children,isValidElement,useId,useState,type ReactNode,type ReactElement} from 'react';
import {CalendarDays,Check,ChevronDown,Globe2,Layers2,SlidersHorizontal} from 'lucide-react';
import {Popover,PopoverContent,PopoverTrigger} from '../components/ui/popover';
import {Command,CommandEmpty,CommandInput,CommandItem,CommandList} from '../components/ui/command';

type Option={value?:string;children?:ReactNode;disabled?:boolean};
export function Filter({label,value,onChange,children,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;children:ReactNode;disabled?:boolean}){
 const [open,setOpen]=useState(false);
 const menuId=useId();
 const options=Children.toArray(children).filter(isValidElement).map(node=>{
  const props=(node as ReactElement<Option>).props;
  const text=Children.toArray(props.children).join('');
  return {value:props.value??text,text,disabled:props.disabled};
 });
 const selected=options.find(o=>o.value===value);
 const Icon=label==='국가'?Globe2:label==='기준월'||label==='기준 관측일'?CalendarDays:label==='카테고리'?Layers2:SlidersHorizontal;
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild><button className="wb-filter-trigger" role="combobox" aria-haspopup="dialog" aria-label={label} aria-controls={menuId} aria-expanded={open} disabled={disabled} title={disabled?'현재 보기에서 지원하지 않습니다':undefined}><Icon size={15}/><span className="wb-filter-label">{label}</span><span className="wb-filter-value">{selected?.text??value}</span><ChevronDown size={13}/></button></PopoverTrigger>
  <PopoverContent id={menuId} className="wb-filter-menu" align="start" sideOffset={7}>
   <Command><CommandInput placeholder={`${label} 검색`} aria-label={`${label} 검색`}/><CommandList aria-label={`${label} 선택`}><CommandEmpty>검색 결과가 없습니다</CommandEmpty>{options.map(option=><CommandItem key={option.value} value={option.text} keywords={[option.value]} disabled={option.disabled} onSelect={()=>{onChange(option.value);setOpen(false);}}><span>{option.text}</span>{option.value===value&&<Check size={15} className="wb-filter-check"/>}</CommandItem>)}</CommandList></Command>
  </PopoverContent>
 </Popover>;
}
