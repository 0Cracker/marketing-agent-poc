import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {here,root,counts,countries,products,profiles,zones,minor,fileSha,inputHashes,readLines,relative,requireApproval} from './spec.mjs';
import {validRecord,loadCatalog,select,summarize} from './catalog.mjs';

export function validateData(data){
 const all=Object.values(data.rows).flat(),byId=new Map(all.map(r=>[r.record_id,r])),definitions=new Map(data.registry.definitions.map(d=>[d.id,d]));
 const lineage=new Map(data.ledger.map(r=>[r.record_id,r])),checks=[];
 const check=(name,fn)=>{fn();checks.push({name,status:'pass'});};
 check('exact_20000_counts_unique_ids',()=>{
  assert.equal(all.length,20000);assert.equal(byId.size,20000);assert.equal(lineage.size,20000);
  for(const [t,n] of Object.entries(counts))assert.equal(data.rows[t].length,n,t);
 });
 check('unchanged_full_canonical_schema',()=>{
  for(const r of all){const v=validRecord(r);assert.ok(v.conforming,r.record_id+' '+JSON.stringify(v.errors));}
 });
 check('all_new_record_and_entity_references_resolve',()=>{
  const externalRecords=new Set(loadCatalog({includeNew:false}).map(x=>x.record.record_id));
  function walk(v,key=''){
   if(v===null||v===undefined)return;
   if(Array.isArray(v)){for(const x of v)walk(x,key);return;}
   if(typeof v==='object'){for(const [k,x] of Object.entries(v))walk(x,k);return;}
   if(typeof v==='string'&&!['artifact_ref','documentation_refs'].includes(key)&&(/(_ref|_refs)$/.test(key)||['related_record_ids','metric_id','aspect_ref','region_ref','entity_ref','variant_ref','metric_definition_refs','kpi_definition_refs'].includes(key))){
    assert.ok(byId.has(v)||definitions.has(v)||externalRecords.has(v),'unresolved '+key+' '+v);
   }
  }
  for(const r of all){walk(r);assert.deepEqual(lineage.get(r.record_id).parents,r.related_record_ids||[]);}
 });
 check('half_open_time_source_availability_and_scopes',()=>{
  for(const r of all){
   const c=lineage.get(r.record_id).country;assert.equal(r.scope_id,`D007-${c}-sample`);assert.equal(r.scenario_id,'D007-expansion');assert.equal(r.temporal.reporting_timezone,zones[c]);
   assert.equal(r.temporal.available_at,data.registry.created_at);assert.equal(r.provenance.collected_at,data.registry.created_at);
   for(const k of ['period','expected_period','planned_period','training_period'])if(r[k]){assert.ok(r[k].start<r[k].end_exclusive,r.record_id);assert.equal(r[k].timezone,zones[c]);}
   for(const k of ['observed_at','ordered_at','event_time','requested_at','processed_at','written_at','changed_at','published_at','sent_at','completed_at','incident_start','incident_end','delivered_at'])if(r[k])assert.ok(Date.parse(r[k])<=Date.parse(r.temporal.available_at),r.record_id+' future '+k);
   for(const p of r.related_record_ids||[])if(byId.has(p))assert.ok(Date.parse(byId.get(p).temporal.available_at)<=Date.parse(r.temporal.available_at));
  }
 });
 check('balanced_product_country_price_review_cells',()=>{
  for(const c of countries)for(const p of products){
   assert.equal(data.rows.T24.filter(r=>r.scope_id.includes('-'+c+'-')&&r.subject_ref===p).length,100);
   assert.equal(data.rows.T08.filter(r=>r.scope_id.includes('-'+c+'-')&&r.variant_ref.endsWith(p)).length,84);
   assert.equal(data.rows.T03.filter(r=>r.scope_id.includes('-'+c+'-')&&r.subject_ref===p).length,24);
   const reviews=data.rows.T24.filter(r=>r.scope_id.includes('-'+c+'-')&&r.subject_ref===p);
   assert.deepEqual([...new Set(reviews.map(r=>r.rating_value))].sort(),[1,2,3,4,5]);
   if(c==='KR')for(let rating=1;rating<=5;rating++)assert.equal(reviews.filter(r=>r.rating_value===rating).length,profiles[p].ratings[rating-1]);
  }
 });
 check('no_competitor_internal_order_cost_inventory_campaign',()=>{
  for(const t of ['T19','T21','T22'])for(const r of data.rows[t])assert.ok(['D005-V-P1A','D005-V-P1B'].includes(r.variant_ref));
  for(const r of data.rows.T12)assert.ok(r.product_refs.every(p=>['P1A','P1B'].includes(p)));
 });
 check('order_gross_refund_status_fulfilment_and_purchase',()=>{
  const lines=new Map(data.rows.T19.map(r=>[r.line_id,r]));
  for(const r of data.rows.T19){
   assert.equal(minor(r.line_gross_total),minor(r.unit_price)*BigInt(r.quantity)-minor(r.line_discount)+minor(r.line_tax));
   assert.equal(r.unit_price.currency,r.line_gross_total.currency);
   const refund=data.rows.T20.filter(x=>x.order_line_ref===r.line_id&&x.status==='completed'&&x.adjustment_kind==='refund').reduce((s,x)=>s+minor(x.refund_amount),0n);
   assert.ok(refund<=minor(r.line_gross_total));assert.equal(r.financial_status,refund===0n?'paid':refund===minor(r.line_gross_total)?'refunded':'partially_refunded');
   assert.equal(data.rows.T18.filter(x=>x.event_name==='purchase'&&x.related_record_ids.includes(r.record_id)).length,1);
  }
  for(const a of data.rows.T20){const r=lines.get(a.order_line_ref);assert.ok(r);assert.equal(a.order_ref,r.order_id);assert.ok(a.quantity<=r.quantity);assert.ok(Date.parse(a.requested_at)>=Date.parse(r.ordered_at));if(a.processed_at)assert.ok(Date.parse(a.processed_at)>=Date.parse(a.requested_at));}
  for(const r of data.rows.T23.filter(x=>x.record_kind==='fulfilment')){if(r.delivered_at)assert.ok(Date.parse(r.shipped_at)<=Date.parse(r.delivered_at));assert.ok(r.related_record_ids.every(id=>byId.get(id).order_id===r.order_ref));}
 });
 check('discount_price_change_and_stock_consistency',()=>{
  for(const r of data.rows.T08){
   const parents=(r.related_record_ids||[]).map(id=>byId.get(id)),promo=parents.find(x=>x.dataset_type==='T09'),stocks=parents.filter(x=>x.dataset_type==='T22');
   if(promo)assert.equal(minor(r.listed_price),minor(r.regular_price)*BigInt(100-Math.round(promo.discount_ratio*100))/100n);else assert.equal(minor(r.listed_price),minor(r.regular_price));
   if(stocks.length)assert.equal(r.availability,stocks.some(x=>x.available_quantity>0)?'in_stock':'out_of_stock');
  }
  for(const r of data.rows.T22){assert.equal(r.on_hand_quantity-r.committed_quantity,r.available_quantity);assert.equal(r.sellable_status,r.available_quantity?'sellable':'out_of_stock');}
  for(const r of data.rows.T35){const [a,b]=r.related_record_ids.map(id=>byId.get(id));assert.deepEqual(r.before_value,a.listed_price);assert.deepEqual(r.after_value,b.listed_price);assert.equal(a.offer_id,b.offer_id);}
 });
 check('ad_breakdowns_missingness_and_variable_rates',()=>{
  for(const parent of data.rows.T13.filter(r=>r.temporal.series_role==='detail')){
   const children=data.rows.T14.filter(r=>r.parent_report_ref===parent.record_id);assert.equal(children.length,2);
   for(const [k,v] of Object.entries(parent.metrics)){
    if(v===null)assert.ok(children.every(r=>r.metrics[k]===null));
    else if(typeof v==='object')assert.equal(children.reduce((s,r)=>s+minor(r.metrics[k]),0n),minor(v));
    else assert.equal(children.reduce((s,r)=>s+r.metrics[k],0),v);
   }
  }
  const rates=data.rows.T13.filter(r=>r.metrics.impressions>0).map(r=>r.metrics.clicks/r.metrics.impressions);
  assert.ok(new Set(rates.map(x=>x.toFixed(4))).size>100,'Fixed CTR patterns');
  assert.ok(data.rows.T13.some(r=>r.quality.availability==='missing'&&r.metrics.clicks===null));
  for(const entry of data.ledger.filter(x=>x.aggregation)){
   const r=byId.get(entry.record_id),a=entry.aggregation,known=a.known_detail_ids.map(id=>byId.get(id));
   assert.equal(known.length+a.residual_days,31);
   for(const [k,v] of Object.entries(r.metrics)){
    if(typeof v==='object')assert.equal(minor(v),known.reduce((s,x)=>s+minor(x.metrics[k]),0n)+minor(a.residual_per_day[k])*BigInt(a.residual_days));
    else assert.equal(v,known.reduce((s,x)=>s+x.metrics[k],0)+a.residual_per_day[k]*a.residual_days);
   }
  }
 });
 check('review_span_semantics_and_rating_independence',()=>{
  const seen=new Set(),sentiments=new Set();
  for(const r of data.rows.T25){const review=byId.get(r.review_ref),e=r.evidence_span;assert.equal(e.record_ref,review.record_id);assert.equal(Array.from(review.body_text).slice(e.start_offset,e.end_offset).join(''),e.quote);assert.ok(r.extractor_version.startsWith('D007-rule'));sentiments.add(r.sentiment);}
  for(const r of data.rows.T24){seen.add(r.body_text);assert.equal(r.verified_purchase,null);assert.equal(r.language,'ko');assert.ok(r.rating_value>=1&&r.rating_value<=5);}
  assert.ok(seen.size>=900,'Insufficient distinct content combinations');assert.ok(sentiments.has('positive')&&sentiments.has('negative')&&sentiments.has('neutral'));
  assert.ok(data.rows.T25.some(r=>r.sentiment==='negative'&&byId.get(r.review_ref).rating_value>=4));
 });
 check('budget_allocations_bounds_and_prediction_formula',()=>{
  for(const r of data.rows.T39.filter(x=>x.record_kind==='budget_scenario')){
   assert.equal(r.allocations.reduce((s,x)=>s+minor(x.amount),0n),minor(r.total_budget));
   for(const a of r.allocations){assert.ok(minor(a.amount)>=minor(a.lower));assert.ok(minor(a.amount)<=minor(a.upper));assert.equal(a.amount.currency,r.total_budget.currency);}
   const model=byId.get(r.related_record_ids[0]),params=Object.fromEntries(model.parameters.map(p=>[p.name,Number(p.value)]));
   const value=r.allocations.reduce((s,a)=>{const b=Number(minor(a.amount));return s+params.scale*b/(params.saturation+b);},0);
   assert.equal(r.expected_measures[0].value,value);
  }
 });
 check('profile_differences_overlap_and_reversals',()=>{
  for(const c of countries){
   const values=new Map(products.map(p=>[p,data.rows.T03.filter(r=>r.scope_id.includes('-'+c+'-')&&r.subject_ref===p).map(r=>r.units_sold)]));
   assert.equal(new Set([...values.values()].map(a=>a.join(','))).size,6);
   const pair=products.some((a,i)=>products.slice(i+1).some(b=>values.get(a).some((v,m)=>v>values.get(b)[m])&&values.get(a).some((v,m)=>v<values.get(b)[m])));
   assert.ok(pair,c+' lacks time-varying rank reversal');
   const overlap=products.some((a,i)=>products.slice(i+1).some(b=>Math.min(...values.get(a))<Math.max(...values.get(b))&&Math.min(...values.get(b))<Math.max(...values.get(a))));
   assert.ok(overlap,c+' lacks overlapping distributions');
  }
 });
 return {status:'pass',rows:all.length,checks,distinct_review_texts:new Set(data.rows.T24.map(r=>r.body_text)).size,
  row_origins:Object.fromEntries([...new Set(all.map(r=>r.value_origin))].map(k=>[k,all.filter(r=>r.value_origin===k).length]))};
}

export function loadData(directory=here){
 return {rows:Object.fromEntries(Object.keys(counts).map(t=>[t,readLines(path.join(directory,'source',t+'.jsonl'))])),registry:JSON.parse(fs.readFileSync(path.join(directory,'definitions.json'))),ledger:readLines(path.join(directory,'lineage.jsonl'))};
}
export function validateCatalog(){
 const c=loadCatalog();assert.equal(c.length,22242);assert.equal(select(c,{batch:'D007'}).length,20000);
 assert.equal(select(c,{batch:'D003B'}).length,1652);assert.equal(select(c,{batch:'D005'}).length,534);
 const grouped=summarize(c,{type:'T24',field:'rating_value'});assert.equal(grouped.status,'separated');
 const newRows=select(c,{batch:'D007'}),before=new Date(Date.parse(newRows[0].record.temporal.available_at)-1).toISOString();assert.equal(select(c,{batch:'D007',asOf:before}).length,0);
 return {status:'pass',rows:c.length,canonical_conforming:c.filter(r=>r.schema_conforming).length,legacy_contract_gap_rows:c.filter(r=>r.batch!=='D007'&&!r.schema_conforming).map(r=>({id:r.record.record_id,type:r.record.dataset_type,errors:r.contract_gaps})),
  mixed_samples_separated:true,asof_before_creation_excluded:true,limitation:'Legacy source fields absent from the common contract remain explicit gaps; no synthetic filling or changed legacy values.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),option=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined,output=option('--output');
 assert.ok(output&&!fs.existsSync(output),'New --output file required');
 const manifest=JSON.parse(fs.readFileSync(path.join(here,'manifest.json'))),approval=option('--approval');requireApproval(approval);
 const data=loadData(),checks=validateData(data);assert.deepEqual(inputHashes(),manifest.existing_input_sha256);
 for(const [file,detail] of Object.entries(manifest.files))assert.equal(fileSha(path.join(here,'source',file)),detail.sha256);
 const {generate,serialize}=await import('./generate.mjs'),replay=generate(approval,manifest.created_at);
 for(const [t,body] of Object.entries(serialize(replay)))assert.equal(body,fs.readFileSync(path.join(here,'source',t+'.jsonl'),'utf8'));
 assert.deepEqual(replay.registry,data.registry);assert.deepEqual(replay.ledger,data.ledger);
 const cmd=[path.join(here,'oracle.py'),'--batch',here,'--tools',path.join(root,'.tools/ontology-validation'),'--progress-file',path.resolve(output)+'.progress.jsonl'];
 const independent=spawnSync(option('--python')||'python',cmd,{encoding:'utf8',maxBuffer:4*1024*1024,timeout:900000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONIOENCODING:'utf-8'}});
 let oracle;try{oracle=JSON.parse(independent.stdout||'{}');}catch{oracle={status:'fail',reason:'Independent process returned invalid JSON'};}
 const status=independent.status===0&&oracle.status==='pass'?'pass':independent.error?.code==='ENOENT'?'not_run':'fail';
 assert.deepEqual(inputHashes(),manifest.existing_input_sha256);
 for(const [file,detail] of Object.entries(manifest.files))assert.equal(fileSha(path.join(here,'source',file)),detail.sha256);
 const report={status,version:'D007-validation-2',new_rows:20000,preservation:'pass',byte_replay:'pass',checks,independent_oracle:oracle,
  independent_process:{exit_code:independent.status,signal:independent.signal,error:independent.error?.code||null,stderr:independent.stderr||'',timeout_ms:900000},
  catalog:validateCatalog(),input_sha256:manifest.existing_input_sha256};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,new_rows:20000,checks:checks.checks.length,independent:oracle.status||'no_report',process_error:independent.error?.code||null,catalog_rows:report.catalog.rows,legacy_contract_gap_rows:report.catalog.legacy_contract_gap_rows.length,report:relative(path.resolve(output))}));
 process.exitCode={pass:0,fail:1,not_run:2}[status];
}
