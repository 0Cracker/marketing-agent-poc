import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {loadCurrentData,sha256,currentDataPlugin} from './current-data.mjs';
import {businessKey} from './data-business-keys.mjs';
const sourceRoot=new URL('../',import.meta.url);
const {CatalogTools,cents}=await import(new URL('backend/agent-tools.mjs',sourceRoot));
const {AgentFlow,FlowStore}=await import(new URL('backend/agent-flow.mjs',sourceRoot));
const {createAgentServer}=await import(new URL('backend/agent-http.mjs',sourceRoot));
const {localPlanner}=await import(new URL('backend/local-planner.mjs',sourceRoot));
const {validRecord}=await import(new URL('docs/research/marketing-ontology/batches/D007/catalog.mjs',sourceRoot));
const {catalog,lock,manifest}=loadCurrentData(),records=catalog.records,byId=new Map(records.map(r=>[r.record_id,r]));
let middleware;currentDataPlugin().configureServer({middlewares:{use:fn=>middleware=fn}});
for(const file of ['manifest.json',...manifest.files.map(f=>f.file)]){
 const response={setHeader(){},end(bytes){this.bytes=bytes;}};middleware({url:'/workbench-data/current/'+file},response,()=>assert.fail('Current data must be served'));assert.deepEqual(response.bytes,fs.readFileSync('data/'+file));
}
for(const url of ['/workbench-data/D008/catalog.json','/workbench-data/current/archive/source-inventory.json','/workbench-data/current/../README.md']){const response={setHeader(){},end(){}};middleware({url},response,()=>assert.fail('Old/archive paths must fail closed'));assert.equal(response.statusCode,404);}
const lines=file=>fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(JSON.parse);
const migration=lines('data/migration-map.jsonl'),provenance=lines('data/provenance.jsonl'),inventory=JSON.parse(fs.readFileSync('data/archive/source-inventory.json'));
assert.equal(migration.length,manifest.preserved_rows);assert.equal(provenance.length,records.length);
assert.equal(new Set(migration.map(m=>m.source_key)).size,migration.length);
assert.equal(new Set(records.map(businessKey)).size,records.length);
for(const [decision,count]of Object.entries(manifest.decisions))assert.equal(migration.filter(m=>m.decision===decision).length,count);
for(const input of inventory){assert.equal(sha256(fs.readFileSync(path.join('data',input.archive))),input.sha256);const base=input.repository==='marketing-agent-poc'?(fs.existsSync('backend/agent-tools.mjs')?'.':'../marketing-agent-poc'):'.';const live=fs.readFileSync(path.join(base,input.path));if(sha256(live)!==input.sha256){/* Shared checkout paths may represent the LF source; archived physical copies retain exact CRLF bytes. */assert.equal(live.toString().replaceAll('\r\n','\n'),fs.readFileSync(path.join('data',input.archive),'utf8').replaceAll('\r\n','\n'),input.path);}}
const currencies={KR:'KRW',JP:'JPY',US:'USD'};
for(const r of records){
 const status=validRecord(r);assert(status.conforming,r.record_id+JSON.stringify(status.errors));
 const walk=v=>{if(typeof v==='string'&&/^D008-(T\d\d|H01)-\d+$/.test(v))assert(byId.has(v),'Missing record '+v);if(v&&typeof v==='object'){if(v.amount!==undefined&&v.currency)assert.equal(v.currency,currencies[r.scope_id.split('-')[1]]);for(const n of Object.values(v))walk(n);}};walk(r);
 for(const id of r.related_record_ids||[])assert(byId.has(id),id);
 if(r.evidence_span){const s=r.evidence_span,parent=byId.get(s.record_ref);assert(parent);assert.equal([...parent.body_text].slice(s.start_offset,s.end_offset).join(''),s.quote);}
 if(r.dataset_type==='T19')assert.equal(cents(r.line_gross_total.amount),cents(r.unit_price.amount)*BigInt(r.quantity)-cents(r.line_discount.amount)+cents(r.line_tax.amount));
 if(r.dataset_type==='T30'){const parents=r.related_record_ids.map(id=>byId.get(id));assert(parents.every(Boolean));const gross=parents.filter(p=>p.dataset_type==='T19').reduce((n,r)=>n+cents(r.line_gross_total.amount),0n),refunds=parents.filter(p=>p.dataset_type==='T20'&&p.status==='completed'&&p.refund_amount).reduce((n,r)=>n+cents(r.refund_amount.amount),0n);assert.equal(cents(r.net_revenue.amount),gross-refunds);}
}
const entries=records.map(record=>({batch:'CURRENT',country:record.dataset_type==='T01'?'GLOBAL':record.scope_id.split('-')[1],record,payload:record,schema_conforming:true}));
const tools=new CatalogTools(entries,{manifest});
const vite=await createServer({configFile:false,root:process.cwd()+'/frontend',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
const flow=new AgentFlow({tools,model:localPlanner,store:new FlowStore()});
let http;
const results=[],agent=[];
try{
 const {createCurrentServices,loadConnectedServices}=await vite.ssrLoadModule('/workbench/current-service.ts');
 const {csv}=await vite.ssrLoadModule('/workbench/presentation.ts');
 const {scopeFromScreen}=await vite.ssrLoadModule('/workbench/agent-client.ts');
 const {service}=createCurrentServices(catalog,lock,manifest);
 const nativeFetch=globalThis.fetch,downloads=[];let initialBytes=0;
 try{
  globalThis.fetch=async input=>{const url=String(input);assert(url.startsWith('/workbench-data/current/'));const file=url.split('/').at(-1);const bytes=fs.readFileSync(path.join('data',file));downloads.push({file,bytes:bytes.length});return new Response(bytes);};
  const lazy=await loadConnectedServices();initialBytes=downloads.reduce((n,d)=>n+d.bytes,0);
  assert(!downloads.some(d=>['definitions.json','reviews.jsonl','commerce-events.jsonl'].includes(d.file)));
  for(const type of manifest.files.map(f=>f.type)){
   const current=await lazy.loadType(type),expected=service.query(type,'JP','ALL',{observed:'ALL',group:'ALL'}),actual=current.query(type,'JP','ALL',{observed:'ALL',group:'ALL'});
   assert.deepEqual(actual.metrics.map(m=>m.value),expected.metrics.map(m=>m.value),type+' lazy metrics');assert.deepEqual(actual.source.map(r=>r.record_id),expected.source.map(r=>r.record_id),type+' lazy evidence');
  }
  assert.equal(new Set(downloads.map(d=>d.file)).size,downloads.length,'Type downloaded more than once');
 }finally{globalThis.fetch=nativeFetch;}
 for(const country of ['KR','JP','US','ALL'])for(const month of ['2026-08','ALL'])for(const type of manifest.files.map(f=>f.type)){
  const options={observed:'ALL',group:'ALL'},m=service.query(type,country,month,options),raw=service.query(type,country,month,{...options,detailOnly:true});
  assert.equal(m.status,'ready',type+'/'+country+'/'+month);assert(!JSON.stringify(m).includes('NaN'));assert(m.charts.length||type==='T01');
  for(const r of [...m.source,...raw.source,...m.charts.flatMap(c=>c.data.flatMap(r=>r.source))])assert(byId.has(r.record_id),'Noncurrent evidence '+r.record_id);
  assert(csv(raw,raw.rows).startsWith('\uFEFF'));assert.equal(csv(raw,raw.rows).split('\r\n').length,raw.rows.length+1);
  results.push({type,country,month,source:m.source.length,raw:raw.source.length,charts:m.charts.length});
 }
 assert.equal(manifest.files.reduce((n,f)=>n+service.query(f.type,'ALL','ALL',{detailOnly:true}).source.length,0),manifest.rows);
 for(const [country,count]of Object.entries({KR:560,JP:730,US:1120})){
  assert.equal(service.query('T24',country,'ALL').metrics[0].value,count);
  for(const month of ['2026-08','ALL']){
   const scope=scopeFromScreen({dataset:'CURRENT',country,month,productIds:catalog.products.map(p=>p.product_id),asOf:manifest.source_created_at,dataHash:manifest.data_sha256,period:manifest.period});
   assert.equal(scope.batch,'CURRENT');assert.throws(()=>tools.validateScope({...scope,dataHash:'0'.repeat(64)}),/inputs_changed/);
   const market=tools.call('market_compare',{},scope),screen=service.query('T03',country,month),screenIds=new Set(screen.source.map(r=>r.record_id));
   for(const fact of market.facts){assert(screenIds.has(fact.recordId));if(fact.field==='sales_value')assert.equal(fact.value,byId.get(fact.recordId).sales_value.amount);}
   const relation=tools.call('relations',{candidate:'price'},scope);assert(relation.recordIds.every(id=>byId.has(id)));
   const run=await flow.analyze({question:'선택 범위의 가격 관련 근거',scope,focus:'price',context:{screenVersion:'workbench-model/1',metricLabels:screen.metrics.map(m=>m.label),evidenceIds:screen.source.slice(0,24).map(r=>r.record_id)}});
   assert.equal(run.status,'analyzed',run.reason);agent.push({country,month,facts:market.facts.length,status:run.status});
   if(month!=='ALL'){
    const budget=await flow.budget({analysisId:run.id,analysisVersion:run.version,userSelected:true});assert.equal(budget.status,'pending_approval',budget.reason);
    const approved=flow.approve(budget.id,{version:budget.version,principal:{id:'local-operator',role:'synthetic_analyst'},expiresAt:new Date(Date.now()+60000).toISOString()});assert.equal(approved.status,'approved');
    const follow=await flow.analyze({parentId:run.id,question:'가격의 반대 근거',focus:'price'});assert.equal(follow.status,'analyzed');assert.equal(flow.get(budget.id).status,'invalidated');assert.equal(flow.get(budget.id).approval,null);
   }
  }
 }
 http=createAgentServer(flow,{runtimeInfo:{mode:'offline_model_substitute',externalModelEnabled:false,dataHash:manifest.data_sha256,dataContract:manifest.contract}});
 await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${http.address().port}/agent-api`;
 const session=await(await fetch(base+'/session')).json();assert.equal(session.dataHash,manifest.data_sha256);
 const oldRun=flow.store.create({role:'analysis',status:'analyzed',inputFingerprint:'old-snapshot',scope:{batch:'D007'}});
 const expired=await fetch(base+'/runs/'+oldRun.id,{headers:{'x-agent-token':session.token}});assert.equal((await expired.json()).error,'inputs_changed');
 const report={pass:true,active:manifest.rows,preserved:manifest.preserved_rows,decisions:manifest.decisions,data_sha256:manifest.data_sha256,businessKeyDuplicates:0,brokenRecordReferences:0,spanMismatches:0,queryCases:results.length,agent,initialBytes,downloads,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),results};
 fs.mkdirSync('docs/design/data-consolidation-20261019',{recursive:true});fs.writeFileSync(process.env.WORKBENCH_CHECK_OUTPUT||'docs/design/data-consolidation-20261019/checks.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,results:undefined}));
}finally{if(http)await new Promise(resolve=>http.close(resolve));flow.close();await vite.close();}
