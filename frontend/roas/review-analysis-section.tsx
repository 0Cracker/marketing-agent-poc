'use client';
import {Fragment,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ExternalLink,Search,X} from 'lucide-react';
import {categoryCounts,collectionRange,defaultReviewSort,eligibleReviewRows,experienceCounts,filterReviewTable,highlightParts,reviewPreview,reviewSummary,sortCategories,sortReviewRows} from './review-analysis';
import type {CategorySort,ReviewPeriod,ReviewPeriodChoice,ReviewRecord,ReviewSort,ReviewSortField,ReviewView} from './review-analysis';
import {SelectionButton} from '../components/ui/selection-button';
import './review-analysis.css';

type Props={caseId:string;asOf:string;periods:ReviewPeriod[];view?:ReviewView;onRetry?:()=>void};
type Selection=ReadonlySet<string>;
const ko=(n:number)=>n.toLocaleString('ko-KR');
const emptyRows:ReviewRecord[]=[];
const date=(value:string|null)=>value?value.slice(0,10).replaceAll('-','.'):'—';
const inclusiveEnd=(value:string)=>new Date(Date.parse(value+'T00:00:00Z')-86400000).toISOString().slice(0,10);
const shortDate=(value:string)=>Number(value.slice(5,7))+'.'+value.slice(8,10);
const safeLink=(value:string|null|undefined)=>{
 if(!value)return null;
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}
};
function ReviewSegments({label,options,value,onChange,disabled=false}:{label:string;options:{id:string;label:string}[];value:string;onChange:(id:string)=>void;disabled?:boolean}){
 return <div className="roas-segment review-segments" role="group" aria-label={label}>{options.map(option=>
  <SelectionButton key={option.id} disabled={disabled} aria-pressed={value===option.id} onClick={()=>onChange(option.id)}>{option.label}</SelectionButton>
 )}</div>;
}
function Highlight({text,term}:{text:string;term:string}){
 return <>{highlightParts(text,term).map((part,index)=>part.match?<mark key={index}>{part.text}</mark>:<span key={index}>{part.text}</span>)}</>;
}
function CategoryChips({review}:{review:ReviewRecord}){
 const [all,setAll]=useState(false);
 if(review.classification==='unclassified')return <span className="review-category-chip neutral">미분류</span>;
 if(review.classification!=='classified')return <span className="review-muted">분류 확인 대기</span>;
 const count=review.categories.length,visible=all?review.categories:review.categories.slice(0,3);
 return <div className="review-chips">{visible.map(item=><span className="review-category-chip" key={item.id}>{item.label}</span>)}{count>3&&<button type="button" className="review-chip-more" aria-expanded={all} onClick={()=>setAll(v=>!v)}>{all?'접기':'+'+(count-3)}</button>}</div>;
}
function ReviewText({text,search,open,onToggle}:{text:string;search:string;open:boolean;onToggle:()=>void}) {
 const content=useRef<HTMLSpanElement>(null);
 const preview=reviewPreview(text,search);
 const [clipped,setClipped]=useState(false);
 useEffect(()=>{
  const node=content.current;
  if(!node)return;
  let active=true;
  const measure=()=>{
   if(!active)return;
   const lineHeight=parseFloat(getComputedStyle(node).lineHeight);
   setClipped(preview!==text||node.scrollHeight>Math.ceil(lineHeight*2)+1);
  };
  measure();
  const observer=new ResizeObserver(measure);
  observer.observe(node);
  void document.fonts.ready.then(measure);
  return()=>{active=false;observer.disconnect();};
 },[text,preview,open]);
 return <div className="review-text-content">
  <span ref={content} className={open?'review-full':'review-preview'}><Highlight text={open?text:preview} term={search}/></span>
  {clipped&&<button type="button" className="review-expand-hint" onClick={onToggle} aria-expanded={open} aria-label={open?'리뷰 원문 접기':'리뷰 원문 펼치기'}>{open?'접기':'더 보기'}</button>}
 </div>;
}
function ReviewRows({rows,search,sort,onSort,expanded,onToggle}:{rows:ReviewRecord[];search:string;sort:ReviewSort;onSort:(field:ReviewSortField)=>void;expanded:Selection;onToggle:(id:string)=>void}){
 return <div className="review-table-scroll" tabIndex={0} aria-label="리뷰 원문 테이블, 가로 스크롤 가능"><table className="review-table">
  <caption className="sr-only">분류 카테고리, 평점, 판매처, 리뷰 원문, 작성일, 원문 확인</caption>
  <colgroup><col style={{width:'18%'}}/><col style={{width:'8%'}}/><col style={{width:'9%'}}/><col style={{width:'43%'}}/><col style={{width:'12%'}}/><col style={{width:'10%'}}/></colgroup>
  <thead><tr>
   <th scope="col">분류 카테고리</th>
   <th scope="col"><SortButton title="평점" field="rating" sort={sort} onChange={onSort}/></th>
   <th scope="col"><SortButton title="판매처" field="sourceName" sort={sort} onChange={onSort}/></th>
   <th scope="col">리뷰 원문</th>
   <th scope="col"><SortButton title="작성일" field="writtenAt" sort={sort} onChange={onSort}/></th>
   <th scope="col">원문 확인</th>
  </tr></thead>
  <tbody>{rows.map(row=>{
   const link=safeLink(row.url),open=expanded.has(row.id),text=row.text||'';
   return <tr key={row.id}>
    <td><CategoryChips review={row}/></td>
    <td>{row.rating===null?'—':row.rating.toFixed(1)+' / 5'}</td>
    <td>{row.sourceName||'—'}</td>
    <td className="review-text-cell">{text?<ReviewText text={text} search={search} open={open} onToggle={()=>onToggle(row.id)}/>:<span className="review-muted review-no-text">원문 없음</span>}</td>
    <td>{date(row.writtenAt)}</td>
    <td>{link?<a href={link} target="_blank" rel="noopener noreferrer" aria-label="원문 보기, 새 탭 열림">원문 보기 <ExternalLink size={12} aria-hidden="true"/></a>:<span className="review-muted">링크 없음</span>}</td>
   </tr>;
  })}</tbody>
 </table></div>;
}
function SortButton({title,field,sort,onChange}:{title:string;field:ReviewSortField;sort:ReviewSort;onChange:(field:ReviewSortField)=>void}){
 return <button type="button" onClick={()=>onChange(field)} aria-label={title+' 정렬'} aria-pressed={sort.field===field} className="review-sort-button">{title} <span aria-hidden="true">{sort.field===field?(sort.direction==='desc'?'↓':'↑'):'↕'}</span></button>;
}
function DataTable({rows,selected,search,sort,onSort,expanded,onToggle,page,pageSize,onPage,onPageSize,range}:{rows:ReviewRecord[];selected:Selection;search:string;sort:ReviewSort;onSort:(field:ReviewSortField)=>void;expanded:Selection;onToggle:(id:string)=>void;page:number;pageSize:number;onPage:(page:number)=>void;onPageSize:(n:number)=>void;range:{first:string;last:string}|null}){
 const filtered=useMemo(()=>sortReviewRows(filterReviewTable(rows,selected,search),sort),[rows,selected,search,sort]);
 const pages=Math.ceil(filtered.length/pageSize),safePage=Math.max(1,Math.min(page,pages||1)),slice=filtered.slice((safePage-1)*pageSize,safePage*pageSize);
 return <section className="roas-card review-table-card" aria-label="리뷰 원문 목록">
  <header className="review-card-heading"><h3>리뷰 원문 <span role="status" aria-live="polite">{ko(filtered.length)}건</span></h3><div className="review-page-size"><span>페이지당</span><ReviewSegments label="페이지당 리뷰 수" options={[10,20,50].map(n=>({id:String(n),label:n+"건"}))} value={String(pageSize)} onChange={id=>onPageSize(Number(id))}/></div></header>
  {filtered.length?<ReviewRows key={safePage+'-'+pageSize} rows={slice} search={search} sort={sort} onSort={onSort} expanded={expanded} onToggle={onToggle}/>:<p className="review-empty">조건에 맞는 리뷰가 없습니다.</p>}
  <footer className="review-table-footer"><div className="review-pages" aria-label="리뷰 페이지 탐색">
   <button disabled={safePage<=1} onClick={()=>onPage(safePage-1)}>이전</button>
   {Array.from({length:pages},(_,index)=>index+1).map(n=><button key={n} className={n===safePage?'active':undefined} aria-current={n===safePage?'page':undefined} onClick={()=>onPage(n)}>{n}</button>)}
   <button disabled={!pages||safePage>=pages} onClick={()=>onPage(safePage+1)}>다음</button>
  </div><p>전체 데이터 수집 기간: {range?date(range.first)+' ~ '+date(range.last):'수집일 확인 불가'}</p></footer>
 </section>;
}
function comparisonRates(beforeCount:number,afterCount:number,beforeTotal:number,afterTotal:number){
 const before=beforeTotal?beforeCount/beforeTotal*100:null;
 const after=afterTotal?afterCount/afterTotal*100:null;
 return {before,after,beforeCount,afterCount,beforeTotal,afterTotal,change:before===null||after===null?null:after-before};
}

function byChange(a:{change:number|null},b:{change:number|null}){
 return Math.abs(b.change??0)-Math.abs(a.change??0);
}

function ComparisonMarks({before,after,beforeCount,afterCount,beforeTotal,afterTotal,change,focusable=false}:ReturnType<typeof comparisonRates>&{focusable?:boolean}){
 const delta=change===null?null:Number(change.toFixed(1));
 const periods=[
  {id:'before',label:'이전',rate:before,count:beforeCount,total:beforeTotal},
  {id:'after',label:'이후',rate:after,count:afterCount,total:afterTotal},
 ];
 return <>
  <span className="review-period-bars">
   {periods.map(({id,label,rate})=><span key={id} className="review-period-mark" tabIndex={focusable&&rate!==null?0:undefined}>
    <span className={'review-bar-track review-period-bar '+id} aria-hidden="true">
     {rate!==null&&<i style={{width:rate+'%'}}/>}
    </span>
    {rate!==null&&<span className="review-period-tooltip"><span className="sr-only">{label} 언급률 </span>{rate.toFixed(1)}%</span>}
   </span>)}
  </span>
  <strong className="review-period-values">
   {periods.map(({id,rate,count,total})=><span key={id}>{rate===null?'—':'('+count+'/'+total+'건)'}</span>)}
   <span className={'review-period-change '+(delta===null||delta===0?'':delta>0?'training-delta-positive':'training-delta-negative')}>
    {delta===null?'비교 불가':(delta>0?'+':'')+delta.toFixed(1)+'%p'}
   </span>
  </strong>
 </>;
}

function DistributionMarks({count,percent}:{count:number;percent:number|null}){
 return <><span className="review-bar-track" aria-hidden="true"><i style={{width:(percent??0)+'%'}}/></span><strong>{count}건, {percent?.toFixed(1)}%</strong></>;
}

export default function ReviewAnalysisSection({caseId,asOf,periods,view,onRetry}:Props){
 const status=view?.caseId===caseId?view.status:['S16','S17'].includes(caseId)?'awaiting_source':'not_provided';
 const rows=view?.caseId===caseId?view.reviews:emptyRows;
 const ready=status==='ready'||status==='partial';
 const [sources,setSources]=useState<Set<string>>(new Set()),[period,setPeriod]=useState<ReviewPeriodChoice>('both');
 const [categories,setCategories]=useState<Set<string>>(new Set()),[searchInput,setSearchInput]=useState(''),[search,setSearch]=useState('');
 const [sort,setSort]=useState<ReviewSort>(defaultReviewSort),[categorySort,setCategorySort]=useState<CategorySort>('many');
 const [expanded,setExpanded]=useState<Set<string>>(new Set()),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(20);
 const [display,setDisplay]=useState<'distribution'|'comparison'>('comparison');
 const [focusedCategory,setFocusedCategory]=useState<string|null>(null);
 const activePeriod=display==='comparison'?'both':period;
 const selectedPeriods=periods.filter(p=>activePeriod==='both'||p.id===activePeriod).sort((a,b)=>a.start.localeCompare(b.start));
 const writingRange=selectedPeriods.length?date(selectedPeriods[0].start)+' ~ '+date(inclusiveEnd(selectedPeriods[selectedPeriods.length-1].end)):'기간 확인 불가';
 const periodLabel=(id:string)=>{const p=periods.find(p=>p.id===id);return p?shortDate(p.start)+'~'+shortDate(inclusiveEnd(p.end)):'기간 확인 불가';};
 const resetPage=useCallback(()=>{setPage(1);setExpanded(new Set());},[]);
 const appliedSearch=useRef('');
 const applySearch=useCallback((value:string)=>{const normalized=value.trim();if(appliedSearch.current===normalized)return;appliedSearch.current=normalized;setSearch(normalized);resetPage();},[resetPage]);
 useEffect(()=>{const timer=setTimeout(()=>applySearch(searchInput),300);return()=>clearTimeout(timer);},[searchInput,applySearch]); // Apply only after typing stops.
 const sourceOptions=useMemo(()=>[...new Map(rows.map(r=>[r.sourceId,r.sourceName])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'ko-KR')),[rows]);
 const eligible=useMemo(()=>ready?eligibleReviewRows(rows,caseId,asOf,periods,activePeriod,sources):[],[ready,rows,caseId,asOf,periods,activePeriod,sources]);
 const periodComparison=useMemo(()=>{
  const baseline=ready?eligibleReviewRows(rows,caseId,asOf,periods,'baseline',sources):[];
  const current=ready?eligibleReviewRows(rows,caseId,asOf,periods,'current',sources):[];
  const parentBefore=new Map(categoryCounts(baseline).map(c=>[c.id,c.count]));
  const parentNow=new Map(categoryCounts(current).map(c=>[c.id,c.count]));
  const experienceBefore=new Map(experienceCounts(baseline).map(c=>[c.id,c.count]));
  const experienceNow=new Map(experienceCounts(current).map(c=>[c.id,c.count]));
  return {baseline:baseline.length,current:current.length,parentBefore,parentNow,experienceBefore,experienceNow,experiences:experienceCounts(current)};
 },[ready,rows,caseId,asOf,periods,sources]);
 const categoryRows=useMemo(()=>sortCategories(categoryCounts(eligible),categorySort),[eligible,categorySort]);
 const summary=useMemo(()=>reviewSummary(eligible),[eligible]);
 const detailRows=useMemo(()=>sortCategories(experienceCounts(eligible).filter(e=>e.categoryId===focusedCategory).map(e=>({...e,percent:eligible.length?100*e.count/eligible.length:null})),categorySort),[eligible,focusedCategory,categorySort]);
 const comparisonRows=categoryRows.map(category=>({...category,...comparisonRates(periodComparison.parentBefore.get(category.id)??0,periodComparison.parentNow.get(category.id)??0,periodComparison.baseline,periodComparison.current)})).sort(byChange);
 const range=useMemo(()=>ready?collectionRange(rows,caseId,asOf):null,[ready,rows,caseId,asOf]);
 const categoryAllowed=view?.classificationStatus==='ready'||(!view?.classificationStatus&&rows.every(r=>r.classification==='classified'||r.classification==='unclassified'));
 function selectSource(id?:string){setSources(new Set(id?[id]:[]));resetPage();}
 function toggleCategory(id:string){setCategories(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});resetPage();}
 function changeSort(field:ReviewSortField){setSort(old=>({field,direction:old.field===field&&old.direction==='desc'?'asc':'desc'}));resetPage();}
 function toggleCategoryDetail(id:string){setFocusedCategory(current=>current===id?null:id);}
 function reset(){setSources(new Set());setPeriod('both');setDisplay('comparison');setFocusedCategory(null);setCategories(new Set());appliedSearch.current='';setSearchInput('');setSearch('');setSort(defaultReviewSort);setCategorySort('many');setPageSize(20);resetPage();}
 const found=filterReviewTable(eligible,categories,search).length;
 if(status==='not_provided')return <section className="review-section" aria-label="상품 1 리뷰 분석"><header className="review-section-title"><h2>리뷰 분석</h2><span>{caseId}, {view?.productName||'쓱쓱샴푸'}</span></header><p className="review-empty" role="status">이 사례에는 상품 1 리뷰 분석 자료가 없습니다.</p></section>;
 if(status==='error')return <section className="review-section" aria-label="상품 1 리뷰 분석"><header className="review-section-title"><h2>리뷰 분석</h2><span>{caseId}, {view?.productName||'쓱쓱샴푸'}</span></header><div className="review-notice error" role="alert"><p>리뷰 데이터를 불러오지 못했습니다. {view?.message||''}</p>{onRetry&&<button onClick={onRetry}>다시 시도</button>}</div></section>;
 return <section className="review-section" aria-label="상품 1 리뷰 분석" data-review-case={caseId}>
  <header className="review-section-title"><div><h2>리뷰 분석</h2><p>현재 사례: {caseId}, {view?.productName||'쓱쓱샴푸'} (EDU-P1), 가상 리뷰</p></div><span className="review-status">{status==='loading'?'불러오는 중':status==='awaiting_source'?'원문 연동 대기':status==='partial'?'일부 결과만 집계됨':'자료 제공'}</span></header>
  {status==='loading'&&<p className="review-notice" role="status">리뷰 데이터를 불러오는 중입니다.</p>}
  {status==='awaiting_source'&&<p className="review-notice" role="status">이 사례의 승인된 리뷰 원문을 아직 화면 조회 경로에 연결하지 않았습니다. 미제공 또는 0건으로 판단하지 않습니다.</p>}
  {ready&&rows.length===0&&<p className="review-notice" role="status">리뷰 자료가 제공되었지만 적격 원문은 0건입니다.</p>}
  {status==='partial'&&<div className="review-notice" role="alert">일부 결과만 집계됨. {view?.message||''}{view?.invalidCount!==undefined?' (검증 실패 '+ko(view.invalidCount)+'건)':''}{onRetry&&<button onClick={onRetry}>다시 시도</button>}</div>}
  {ready&&(!categoryAllowed||view?.classificationStatus==='error')&&<p className="review-notice" role="status">분류 결과가 미승인 또는 오류 상태입니다. 원문은 조회할 수 있지만 카테고리 수치와 미분류 결과는 표시하지 않습니다. {onRetry&&<button onClick={onRetry}>분류 다시 시도</button>}</p>}
  <p className="review-writing-range">리뷰 작성일 기준 {writingRange}</p>
  <div className="review-stat-grid">
   <article className="roas-card review-stat"><span>조회된 리뷰</span><strong>{ready?ko(summary.count)+'건':'—'}</strong></article>
   <article className="roas-card review-stat"><span>평균 평점</span><strong>{ready?(summary.average===null?'—':summary.average.toFixed(1)+' / 5'):'—'}</strong><small>현재 조회 범위, 미분류 포함</small></article>
   <article className="roas-card review-stat"><span>최다 언급 카테고리</span><strong className="review-top-name">{ready&&categoryAllowed&&summary.top.length?summary.top.slice(0,2).map(v=>v.label).join(', ')+(summary.top.length>2?' +'+(summary.top.length-2):''):'—'}</strong><small>{ready&&categoryAllowed&&summary.top.length?summary.top[0].count+'건 / '+summary.count+'건 ('+(summary.top[0].count/summary.count*100).toFixed(1)+'%)':'현재 조회 범위 기준'}</small></article>
  </div>
  <section className="roas-card review-chart-card" aria-label="카테고리 분포">
   <header className="review-card-heading"><h3>{display==='distribution'?'카테고리 분포':'카테고리 기간 비교'}</h3><button type="button" onClick={reset}>전체 필터 초기화</button></header>
   <ReviewSegments label="카테고리 보기" options={[{id:'comparison',label:'기간 비교'},{id:'distribution',label:'전체 분포'}]} value={display} onChange={id=>{setDisplay(id as 'distribution'|'comparison');resetPage();}}/>
   <div className="review-controls" aria-label="리뷰 공통 필터">
    <div className="review-filter-group"><span className="review-filter-label">판매처</span><div className="review-source-options" role="group" aria-label="판매처, 단일 선택">
     <SelectionButton className="review-filter-pill" aria-pressed={!sources.size} disabled={!ready} onClick={()=>selectSource()}>전체 판매처</SelectionButton>
     {sourceOptions.map(([id,name])=><SelectionButton key={id} className="review-filter-pill" aria-pressed={sources.has(id)} disabled={!ready} onClick={()=>selectSource(id)}>{name}</SelectionButton>)}
    </div></div>
    {display==='distribution'&&<div className="review-filter-group"><span className="review-filter-label">리뷰 작성일</span>
     <ReviewSegments label="리뷰 작성일 기간" options={[{id:'both',label:'전체 기간'},{id:'baseline',label:periodLabel('baseline')},{id:'current',label:periodLabel('current')}]} value={period} disabled={!ready} onChange={id=>{setPeriod(id as ReviewPeriodChoice);resetPage();}}/>
    </div>}
    {display==='distribution'&&<div className="review-filter-group"><span className="review-filter-label">카테고리 정렬</span>
     <ReviewSegments label="카테고리 정렬" options={[{id:'many',label:'많은순'},{id:'few',label:'적은순'},{id:'name',label:'가나다순'}]} value={categorySort} disabled={!ready||!categoryAllowed} onChange={id=>setCategorySort(id as CategorySort)}/>
    </div>}
   </div>
   {ready&&categoryAllowed&&(display==='comparison'||eligible.length>0)?<>
    {display==='comparison'&&<div className="review-compare-legend">
     <span><i className="review-period-key before" aria-hidden="true"/> {periodLabel('baseline')}, {ko(periodComparison.baseline)}건</span>
     <span><i className="review-period-key after" aria-hidden="true"/> {periodLabel('current')}, {ko(periodComparison.current)}건</span>
     <small>언급률 변화 폭 순</small>
    </div>}
    <div className="review-axis" aria-hidden="true"><span/><div className="review-axis-ticks">{[0,25,50,75,100].map(n=><span key={n}>{n}%</span>)}</div><span/></div>
    <div className="review-bars">
     {(display==='comparison'?comparisonRows:categoryRows).map(category=>{
      const open=focusedCategory===category.id;
      const detailId='review-category-detail-'+category.id;
      const values=display==='comparison'
       ? <ComparisonMarks {...comparisonRates(periodComparison.parentBefore.get(category.id)??0,periodComparison.parentNow.get(category.id)??0,periodComparison.baseline,periodComparison.current)}/>
       : <DistributionMarks count={category.count} percent={category.percent}/>;
      return <Fragment key={category.id}>
       <button type="button" className="review-bar-row" aria-expanded={open} aria-controls={detailId} onClick={()=>toggleCategoryDetail(category.id)}>
        <span>{category.label}<span className="review-drill-arrow" aria-hidden="true">{open?' ▾':' ▸'}</span></span>{values}
       </button>
       <div id={detailId} className="review-inline-details" hidden={!open}>
        {open&&(display==='comparison'
         ? periodComparison.experiences.filter(item=>item.categoryId===category.id).map(item=>({
          ...item,...comparisonRates(periodComparison.experienceBefore.get(item.id)??0,periodComparison.experienceNow.get(item.id)??0,periodComparison.baseline,periodComparison.current),
         })).sort(byChange).map(item=><div className="review-bar-row review-detail-bar" key={item.id}><span>{item.label}</span><ComparisonMarks {...item} focusable/></div>)
         : detailRows.map(item=><div className="review-bar-row review-detail-bar" key={item.id}><span>{item.label}</span><DistributionMarks count={item.count} percent={item.percent}/></div>))}
       </div>
      </Fragment>;
     })}
    </div>
   </>:<p className="review-empty">{ready?(categoryAllowed?'표시할 카테고리가 없습니다.':'검증된 카테고리 자료가 없습니다.'):'원문 연동 후 카테고리를 표시합니다.'}</p>}
   <p className="review-hint">한 리뷰가 여러 카테고리에 포함될 수 있어 비율 합계가 100%를 넘을 수 있습니다. {display==='comparison'?'언급률은 선택한 판매처의 각 기간 전체 리뷰를 기준으로 계산합니다.':'언급률은 판매처와 작성일 조건에 맞는 전체 리뷰를 기준으로 계산합니다.'}</p>
  </section>
  <div className="review-table-filters"><div className="review-filter-heading"><h3>리뷰 원문 필터</h3><span>선택한 카테고리만 원문 목록에 적용됩니다.</span></div>
   <div className="review-category-options" role="group" aria-label="분류 카테고리, 복수 선택">{categoryRows.map(c=><SelectionButton key={c.id} className="review-filter-pill" aria-pressed={categories.has(c.id)} disabled={!ready||!categoryAllowed} onClick={()=>toggleCategory(c.id)}>{c.label}</SelectionButton>)}
    <SelectionButton className="review-filter-pill review-unclassified" aria-pressed={categories.has('__unclassified__')} disabled={!ready||!categoryAllowed} onClick={()=>toggleCategory('__unclassified__')}>미분류</SelectionButton>
   </div>
   <label className="review-search"><Search size={15} aria-hidden="true"/><input aria-label="리뷰 원문 검색" placeholder="리뷰 원문 검색" disabled={!ready} value={searchInput} onChange={e=>setSearchInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();applySearch(searchInput);}}}/>{searchInput&&<button type="button" aria-label="검색어 삭제" onClick={()=>{setSearchInput('');applySearch('');}}><X size={15}/></button>}</label>
  </div>
  {ready?<DataTable rows={eligible} selected={categories} search={search} sort={sort} onSort={changeSort} expanded={expanded} onToggle={id=>setExpanded(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;})} page={page} pageSize={pageSize} onPage={n=>{setPage(n);setExpanded(new Set());}} onPageSize={n=>{setPageSize(n);resetPage();}} range={range}/>:<section className="roas-card review-table-card"><h3>리뷰 원문 <span>—건</span></h3><p className="review-empty">{status==='loading'?'불러오는 중':'검증된 원문 연결 대기'}</p></section>}
  {ready&&<span className="sr-only" role="status">필터와 검색 적용 후 {found}건</span>}
 </section>;
}
