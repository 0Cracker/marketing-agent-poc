import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trainingScreenData} from '../../scripts/roas/training-data.mjs';
import {selectRecords} from '../../shared/roas/training-dashboard.mjs';
import {groupRecordsByDate,groupRelatedRecords,recordFieldValue,recordHeadline,recordPreview} from '../../frontend/roas/operational-records-model.ts';

const filters={channel:'all',source:'all',campaignId:'all',device:'all'};

test('S16 timeline separates nine later records from twenty-four initial records',()=>{
 const data=trainingScreenData(undefined,'S16','initial');
 const records=selectRecords(data,filters)
  .filter(row=>row.date<=data.asOf.slice(0,10)&&row.date<data.periods.find(p=>p.id==='current').end)
  .sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 assert.equal(records.length,33);
 const initial=records.filter(row=>row.date===data.periods.find(p=>p.id==='baseline').start);
 const later=records.filter(row=>row.date!==data.periods.find(p=>p.id==='baseline').start);
 assert.equal(initial.length,24);
 assert.equal(later.length,9);
 assert.deepEqual(groupRecordsByDate(later).map(group=>[group.date,group.records.length]),[
  ['2026-08-24',1],['2026-08-21',1],['2026-08-17',7],
 ]);
 const scoped=selectRecords(data,{...filters,campaignId:'EDU-C1'});
 assert(scoped.some(row=>row.id==='CASE-S16-2'));
 assert(!scoped.some(row=>row.id==='CASE-S16-4'));
 assert(scoped.some(row=>row.id==='CASE-S16-13'),'campaign-neutral product change is retained');
});

test('S16 nine events form four display activities without modifying evidence',()=>{
 const data=trainingScreenData(undefined,'S16','initial');
 const records=selectRecords(data,filters).filter(r=>r.date>'2026-08-03')
  .sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const before=JSON.stringify(records);
 const grouped=groupRecordsByDate(records).flatMap(day=>groupRelatedRecords(day.records,data.caseId));
 assert.deepEqual(grouped.map(activity=>[activity.title||activity.records[0].id,activity.records.length]),[
  ['CASE-S16-12',1],['CASE-S16-11',1],['광고 유입 확대 설정',4],['상품 할인 동시 종료',3],
 ]);
 assert.equal(new Set(grouped.flatMap(activity=>activity.records.map(r=>r.id))).size,9);
 assert.equal(JSON.stringify(records),before);
 const campaignOnly=selectRecords(data,{...filters,campaignId:'EDU-C1'}).filter(r=>r.date==='2026-08-17');
 assert.deepEqual(groupRelatedRecords(campaignOnly,data.caseId).map(a=>a.records.length).sort(),[1,3]);
 const s17=trainingScreenData(undefined,'S17','initial');
 const s17events=selectRecords(s17,filters).filter(r=>r.date>'2026-08-03');
 assert.equal(groupRelatedRecords(s17events,s17.caseId).length,s17events.length);
});

test('change, incident and creative previews use the original fields without inferred causal claims',()=>{
 const data=trainingScreenData(undefined,'S16','initial');
 const get=id=>data.records.find(record=>record.id===id);
 assert.equal(recordHeadline(get('CASE-S16-13'),data),'쓱쓱샴푸 할인 종료');
 assert.deepEqual(recordPreview(get('CASE-S16-13')),{kind:'change',label:'할인율',before:'20%',after:'0%'});
 assert.match(recordHeadline(get('CASE-S16-2'),data),/예산 및 타깃 변경/);
 assert.deepEqual(recordPreview(get('CASE-S16-2')),{kind:'change',label:'변경 내용',
  before:'일예산 240,000원, 기존 관심 집단',after:'일예산 420,000원, 확장 타깃 포함'});
 assert.match(recordHeadline(get('CASE-S16-11'),data),/간편결제 처리 오류/);
 assert.match(recordPreview(get('CASE-S16-11')).text,/PAYMENT_CALLBACK_TIMEOUT/);
 assert.match(recordPreview(get('CASE-S16-11')).secondary,/종료 2026\.08\.25 00:00/);
 assert.match(recordPreview(get('CASE-S16-12')).text,/소재 v2 집행/);
 assert.equal(recordFieldValue('일예산',240000),'240,000원');
 assert.equal(recordFieldValue('구매가능',false),'불가');
 const budgetCase=trainingScreenData(undefined,'S06','initial');
 const budget=budgetCase.records.find(record=>record.id==='CASE-S06-1');
 assert.match(recordHeadline(budget,budgetCase),/일예산 변경/);
 assert.doesNotMatch(recordHeadline(budget,budgetCase),/타깃 변경/);
});

test('other scenarios retain usable record previews for non-change categories',()=>{
 for(const caseId of ['S06','S11','S13','S14','S17','S18']){
  const data=trainingScreenData(undefined,caseId,'initial');
  for(const record of data.records){
   assert(recordHeadline(record,data));
   const preview=recordPreview(record);
   assert(preview.kind==='change'?preview.before&&preview.after:preview.text,record.id);
  }
 }
});

test('sidebar links to chronological records with inline expandable details',()=>{
 const dashboard=fs.readFileSync(new URL('../../frontend/roas/training-dashboard.tsx',import.meta.url),'utf8');
 const ui=fs.readFileSync(new URL('../../frontend/roas/operational-records.tsx',import.meta.url),'utf8');
 assert.match(dashboard,/운영 기록<\/button>/);
 assert.match(dashboard,/RecordsPage key=\{caseId\} data=\{data\} filters=\{filters\}/);
 assert.match(dashboard,/setRecordsPage\(route\.recordsPage===true\)/);
 assert.match(ui,/groupRecordsByDate\(events\)/);
 assert.match(ui,/groupRelatedRecords\(group.records,data.caseId\)/);
 assert.match(ui,/className="training-record-activity"/);
 assert.match(ui,/className="training-records-initial"/);
 assert.match(ui,/className="training-record-entry"/);
 assert.match(ui,/Object\.entries\(record\.values\)/);
 assert.doesNotMatch(ui,/상세 보기|training-records-table|onEvidence/);
});

test('ROAS chart retains its original shape without operational event markers',()=>{
 const dashboard=fs.readFileSync(new URL('../../frontend/roas/training-dashboard.tsx',import.meta.url),'utf8');
 assert.match(dashboard,/metric=\{focusMetrics\[0\]\}\/>/);
 assert.doesNotMatch(dashboard,/ReferenceLine|recordDates|markRecords|training-record-marker-note/);
});
