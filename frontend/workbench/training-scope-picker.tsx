'use client';
import {useRef,useState} from 'react';
import {ChevronDown,Search,X} from 'lucide-react';
import {campaignDisplayName,displayTrainingText,trainingMediaOptions} from '../../shared/training-dashboard.mjs';
import type {Campaign,Filters,TrainingData} from '../../shared/training-dashboard.mjs';

const sourceNames:Record<string,string>={google:'Google',facebook:'Facebook',instagram:'Instagram',naver_blog:'네이버 블로그'};
const typeNames:Record<string,string>={search_ads:'검색광고',feed_ads:'피드광고',blog_affiliate:'블로그 제휴',creator_affiliate:'크리에이터 제휴'};
const providerName=(campaign:Campaign)=>campaign.channel==='content'?'콘텐츠 제휴':campaign.platform;
const description=(campaign:Campaign)=>[providerName(campaign),sourceNames[campaign.source]||campaign.source,typeNames[campaign.adType]||campaign.adType].join(', ');

export default function TrainingScopePicker({data,filters,onCampaign,onMedia}:{data:TrainingData|null;filters:Filters;onCampaign:(id:string)=>void;onMedia:(key:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null);
 const [mode,setMode]=useState('campaign'),[query,setQuery]=useState('');
 const selected=data?.campaigns.find(c=>c.id===filters.campaignId);
 const scoped=data?.campaigns.filter(c=>(filters.channel==='all'||c.channel===filters.channel)&&(!filters.source||filters.source==='all'||c.source===filters.source))||[];
 const providers=[...new Set(scoped.map(providerName))];
 const scopeLabel=selected&&data?campaignDisplayName(data,selected.id):scoped.length===data?.campaigns.length?'전체 캠페인':providers.length===1?providers[0]+(filters.source!=='all'&&filters.source?', '+(sourceNames[filters.source]||filters.source):''):'선택한 집행처';
 const campaigns=data?.campaigns.filter(c=>(campaignDisplayName(data,c.id)+' '+c.id+' '+displayTrainingText(c.id)+' '+description(c)).toLocaleLowerCase().includes(query.toLocaleLowerCase()))||[];
 const groups=[...new Set(campaigns.map(providerName))];
 function close(){dialog.current?.close();trigger.current?.focus();}
 function choose(id:string){onCampaign(id);close();}
 function providerScope(rows:Campaign[]){
  // 현재 조회 계약으로 표현할 수 있는 집행처만 전체 집계를 제공한다.
  if(!data||new Set(rows.map(c=>c.channel)).size!==1)return null;
  const channel=rows[0].channel,source=new Set(rows.map(c=>c.source)).size===1?rows[0].source:'all';
  const option=trainingMediaOptions(data).find(item=>item.channel===channel&&item.source===source);
  if(!option)return null;
  const matched=data.campaigns.filter(c=>c.channel===channel&&(source==='all'||c.source===source));
  return matched.length===rows.length?option.key:null;
 }
 return <div className="training-scope-picker">
  <button ref={trigger} className="training-scope-trigger" disabled={!data} onClick={()=>{setQuery('');dialog.current?.showModal();search.current?.focus();}} aria-haspopup="dialog" aria-label={`분석 대상: ${scopeLabel}`}><Search size={15}/><span>{scopeLabel}</span><ChevronDown className="training-scope-chevron" size={16} aria-hidden="true"/></button>
  <dialog ref={dialog} className="training-scope-dialog" aria-labelledby="training-scope-title" onClick={event=>{if(event.target===dialog.current)close();}}>
   <header><h2 id="training-scope-title">분석 대상 선택</h2><button aria-label="분석 대상 선택 닫기" onClick={close}><X size={18}/></button></header>
   <div className="training-scope-browser">
    <div className="training-scope-modes"><button aria-pressed={mode==='campaign'} onClick={()=>setMode('campaign')}>캠페인으로 찾기</button><button aria-pressed={mode==='provider'} onClick={()=>setMode('provider')}>집행처로 찾기</button></div>
    <label className="training-scope-search"><Search size={16}/><input ref={search} aria-label="캠페인, 집행처, 유형 검색" placeholder="캠페인명, ID, 집행처 또는 유형 검색" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    <button className="training-scope-all" onClick={()=>choose('all')}>전체 캠페인 조회</button>
    <div className="training-scope-results" onClick={event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-campaign], button[data-media]');if(!button)return;if(button.dataset.campaign)onCampaign(button.dataset.campaign);else if(button.dataset.media)onMedia(button.dataset.media);close();}}>
     {mode==='campaign'?campaigns.map(c=><button key={c.id} className="training-scope-option" aria-current={filters.campaignId===c.id?'true':undefined} data-campaign={c.id}><strong>{data&&campaignDisplayName(data,c.id)}</strong><small>{description(c)}</small></button>):groups.map(name=>{
      const rows=campaigns.filter(c=>providerName(c)===name);
      const complete=data?.campaigns.filter(c=>providerName(c)===name)||[];
      const key=providerScope(complete);
      return <section className="training-scope-group" key={name}><div><h3>{name}</h3>{key&&<button data-media={key}>이 집행처 전체 조회</button>}</div>{rows.map(c=><button key={c.id} className="training-scope-option" data-campaign={c.id}><strong>{data&&campaignDisplayName(data,c.id)}</strong><small>{sourceNames[c.source]||c.source}, {typeNames[c.adType]||c.adType}</small></button>)}</section>;
     })}
     {!campaigns.length&&<p>검색에 맞는 캠페인이 없습니다.</p>}
    </div>
   </div>
  </dialog>
 </div>;
}
