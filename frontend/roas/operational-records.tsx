'use client';
import {useMemo,useState} from 'react';
import {ArrowRight,ChevronDown,Search} from 'lucide-react';
import {selectRecords} from '../../shared/roas/training-dashboard.mjs';
import type {DetailRecord,Filters,TrainingData} from '../../shared/roas/training-dashboard.mjs';
import {groupRecordsByDate,groupRelatedRecords,recordCategories,recordFieldValue,recordHeadline,recordPreview,recordSubject} from './operational-records-model';
import './operational-records.css';

function RecordEntry({record,data}:{record:DetailRecord;data:TrainingData}){
 const preview=recordPreview(record),title=recordHeadline(record,data),subject=recordSubject(record,data);
 return <details className="training-record-entry">
  <summary>
   <div className="training-record-entry-content">
    <div className="training-record-entry-labels">
     <span className={`training-record-kind training-record-kind-${record.category}`}>{recordCategories[record.category]||record.category}</span>
     {!title.includes(subject)&&<span className="training-record-subject">{subject}</span>}
    </div>
    <strong className="training-record-entry-title">{title}</strong>
    {preview.kind==='change'?
     <div className="training-record-before-after">
      {preview.label!=='변경 내용'&&<span className="training-record-change-label">{preview.label}</span>}
      <span className="training-record-before">{preview.before}</span>
      <ArrowRight size={14} aria-hidden="true"/>
      <span className="training-record-after">{preview.after}</span>
     </div>:
     <div className="training-record-entry-excerpt">{preview.text}{preview.secondary&&<span>{preview.secondary}</span>}</div>}
   </div>
   <ChevronDown size={17} aria-hidden="true" className="training-record-toggle"/>
  </summary>
  <div className="training-record-entry-details">
   <h4>기록 상세</h4>
   <dl>{Object.entries(record.values).map(([field,value])=>
    <div key={field}><dt>{field}</dt><dd>{recordFieldValue(field,value,String(record.values['항목']||''))}</dd></div>)}</dl>
   <p className="training-record-origin">기록 ID: {record.id} <span>기록일: {record.date}</span></p>
  </div>
 </details>;
}


function ActivityEntry({records,title,summary,data}:{records:DetailRecord[];title:string;summary:string;data:TrainingData}){
 return <details className="training-record-activity">
  <summary>
   <div className="training-record-entry-content">
    <div className="training-record-entry-labels">
     <span className="training-record-kind training-record-kind-change">운영 변경</span>
     <span className="training-record-subject">같은 날의 관련 기록 {records.length}건</span>
    </div>
    <strong className="training-record-entry-title">{title}</strong>
    <div className="training-record-activity-summary">{summary}</div>
    <div className="training-record-activity-targets">{records.map(record=><span key={record.id}>{recordSubject(record,data)}</span>)}</div>
   </div>
   <ChevronDown size={17} aria-hidden="true" className="training-record-toggle"/>
  </summary>
  <div className="training-record-activity-detail">
   <p>연결 기록 {records.length}건, 항목을 선택하면 변경 전후 원문을 확인할 수 있습니다.</p>
   {records.map(record=><RecordEntry key={record.id} record={record} data={data}/>)}
  </div>
 </details>;
}

export default function RecordsPage({data,filters}:{data:TrainingData;filters:Filters}){
 const [category,setCategory]=useState('all'),[search,setSearch]=useState('');
 const records=useMemo(()=>selectRecords(data,filters)
  .filter(record=>record.date<=data.asOf.slice(0,10)&&record.date<data.periods.find(period=>period.id==='current')!.end)
  .sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)),[data,filters]);
 const activeFilter=category!=='all'||search.trim().length>0;
 const term=search.trim().toLocaleLowerCase();
 const visible=records.filter(record=>(category==='all'||category===record.category)&&
  (!term||(JSON.stringify(record)+' '+recordHeadline(record,data)+' '+recordSubject(record,data)).toLocaleLowerCase().includes(term)));
 const baselineDate=data.periods.find(period=>period.id==='baseline')?.start;
 const initial=activeFilter?[]:visible.filter(record=>record.date===baselineDate);
 const events=activeFilter?visible:visible.filter(record=>record.date!==baselineDate);
 const groups=groupRecordsByDate(events);
 const categories=Object.entries(recordCategories).filter(([id])=>records.some(record=>record.category===id));
 return <section className="training-records-page">
  <div className="training-records-page-heading">
   <div><h1>운영 기록</h1><p>운영 변경과 장애 이력을 날짜순으로 확인합니다.</p></div>
   <span className="training-records-overall">연결 기록 <strong>{records.length.toLocaleString('ko-KR')}건</strong></span>
  </div>
  <section className="roas-card training-records-surface">
   <header className="training-records-surface-heading">
    <div><span className="training-records-eyebrow">{activeFilter?'검색 결과':'주요 운영 이력'}</span>
     <h2>{activeFilter?visible.length:events.length}<span>건</span></h2></div>
    <p>{activeFilter?'조건에 일치하는 기록입니다.':'같은 날 발생한 관련 변경은 묶어 표시합니다. 원천 기록은 그대로 유지됩니다.'}</p>
   </header>
   <div className="training-records-controls">
    <label>기록 종류 <select value={category} onChange={event=>setCategory(event.target.value)}>
     <option value="all">전체 종류</option>{categories.map(([id,label])=><option value={id} key={id}>{label}</option>)}
    </select></label>
    <label className="training-records-search-label">기록 검색
     <span className="training-records-search-box"><Search size={15} aria-hidden="true"/><input type="search" placeholder="캠페인, 상품, 변경 내용 검색" value={search} onChange={event=>setSearch(event.target.value)}/></span>
    </label>
   </div>
   <div className="training-records-timeline">
    {groups.map(group=><section key={group.date} className="training-record-day">
     <div className="training-record-day-heading">
      <span className="training-record-day-dot" aria-hidden="true"/>
      <time dateTime={group.date}>{group.date.replaceAll('-','.')}</time>
      <span className="training-record-day-count">{group.records.length}건</span>
     </div>
     <div className="training-record-day-entries">{groupRelatedRecords(group.records,data.caseId).map(activity=>
      activity.title&&activity.summary?<ActivityEntry key={activity.key} records={activity.records} title={activity.title} summary={activity.summary} data={data}/>:
       <RecordEntry key={activity.key} record={activity.records[0]} data={data}/>)}</div>
    </section>)}
    {!events.length&&<p className="training-records-empty">{activeFilter?'조건에 맞는 운영 기록이 없습니다.':'초기 설정 이후의 운영 기록이 없습니다.'}</p>}
   </div>
   {!activeFilter&&initial.length>0&&<details className="training-records-initial">
    <summary><div><strong>초기 설정 및 상태</strong><span>{baselineDate?.replaceAll('-','.')} · {initial.length}건의 시작 시점 기록</span></div><ChevronDown size={18} aria-hidden="true"/></summary>
    <div className="training-records-initial-body">{initial.map(record=><RecordEntry key={record.id} record={record} data={data}/>)}</div>
   </details>}
  </section>
  <p className="training-records-causality">운영 기록은 발생 사실을 보여줍니다. 성과 변화와 발생 시점이 겹치더라도 원인으로 확정할 수는 없습니다.</p>
 </section>;
}
