import test from 'node:test';
import assert from 'node:assert/strict';
import {tools,scope,rawRows,sourceHashes,catalog} from './support.mjs';

test('S01 scope: explicit country, products, window and asOf accepted',()=>{
  assert.deepEqual(tools.validateScope(scope),scope);
});
for(const [id,change,code] of [
  ['S02',{country:undefined},'scope_required'],['S03',{country:'ZZ'},'scope_invalid'],
  ['S04',{productIds:[]},'scope_required'],['S05',{productIds:['not-a-product']},'product_unknown'],
  ['S06',{start:'2026-02-30'},'scope_invalid'],['S07',{end:scope.start},'scope_invalid'],
  ['S08',{asOf:'yesterday'},'scope_invalid'],['S09',{scopeId:'D007-JP-sample'},'scope_invalid'],
  ['S10',{productIds:['P1A','P1A']},'scope_invalid']]) {
  test(`${id} scope rejects ${JSON.stringify(change)}`,()=>assert.throws(()=>tools.validateScope({...scope,...change}),e=>e.code===code));
}
test('Q01 future acquisition is unavailable, not an empty successful analysis',()=>{
  assert.throws(()=>tools.call('market_compare',{}, {...scope,asOf:'2026-10-16T00:00:00Z'}),e=>e.code==='data_unavailable');
});
test('Q02 legacy contract gaps cannot silently enter operational observations',()=>{
  const result=tools.quality({...scope,batch:'D003B',scopeId:'D003B-KR'});
  assert.ok(result.excluded>0);assert.equal(result.rawFallback,false);
});
test('A01 market totals and shares independently reconcile to raw records',()=>{
  const result=tools.call('market_compare',{},scope);
  const rows=rawRows('T03').filter(r=>r.scope_id===scope.scopeId&&r.period.start===scope.start);
  for(const product of scope.productIds){
    const raw=rows.find(r=>r.subject_ref===product);
    const fact=result.facts.find(f=>f.recordId===raw.record_id&&f.field==='sales_value');
    assert.equal(fact.value,raw.sales_value.amount);
    assert.equal(fact.unit,raw.sales_value.currency);
  }
  assert.equal(new Set(result.facts.map(f=>f.id)).size,result.facts.length);
  assert.equal(result.causalEffect,null);assert.equal(result.coverage,'sample');
});
test('A02 relation paths use actual campaign/product and source links',()=>{
  const result=tools.call('relations',{candidate:'media'},scope);
  const raw=rawRows('T12').find(r=>r.scope_id===scope.scopeId&&r.product_refs.includes('P1A'));
  assert.ok(result.edges.some(e=>e.from===raw.campaign_id&&e.predicate==='promotes'&&e.to==='P1A'));
  assert.ok(result.edges.every(e=>e.evidenceId&&catalog.some(x=>x.record.record_id===e.evidenceId)));
});
test('A03 price evidence retains both positive and negative annotations',()=>{
  const result=tools.call('relations',{candidate:'price'},scope);
  assert.ok(result.supportIds.length);assert.ok(result.counterIds.length);
  assert.equal(result.causalEffect,null);assert.ok(result.limitations.includes('association_not_causation'));
});
test('A04 evidence cannot cross country, product or asOf boundaries',()=>{
  for(const row of [rawRows('T24').find(r=>r.scope_id==='D007-JP-sample'),rawRows('T24').find(r=>r.scope_id===scope.scopeId&&r.subject_ref==='P3B')]){
    assert.throws(()=>tools.call('evidence',{ids:[row.record_id]},scope),e=>e.code==='evidence_out_of_scope');
  }
});
test('A05 source spans exactly match parent review text',()=>{
  const result=tools.call('relations',{candidate:'price'},scope);
  const evidence=tools.call('evidence',{ids:[result.supportIds[0]]},scope);
  const annotation=evidence.records[0];const parent=rawRows('T24').find(r=>r.record_id===annotation.review_ref);
  assert.equal([...parent.body_text].slice(annotation.evidence_span.start_offset,annotation.evidence_span.end_offset).join(''),annotation.evidence_span.quote);
});
for(const [id,name,args,code] of [
  ['A06','execute_sql',{},'tool_forbidden'],['A07','market_compare',{country:'JP'},'tool_arguments'],
  ['A08','relations',{candidate:'causal_effect'},'tool_arguments'],['A09','evidence',{ids:['unknown']},'evidence_out_of_scope'],
  ['A10','evidence',{ids:[]},'tool_arguments']]){
  test(`${id} tool trust boundary: ${name}`,()=>assert.throws(()=>tools.call(name,args,scope),e=>e.code===code));
}
test('A11 no source objects or raw records are changed by tools',()=>{
  const before=sourceHashes();tools.call('market_compare',{},scope);tools.call('relations',{candidate:'price'},scope);
  assert.deepEqual(sourceHashes(),before);
});
test('B01 budget input lists compatible, explicit synthetic models/scenarios/policies',()=>{
  const r=tools.call('budget_inputs',{},scope);
  assert.ok(r.scenarios.length>1&&r.models.length&&r.policies.length);
  assert.ok(r.policies.every(p=>p.period.start<=scope.start&&p.period.end_exclusive>=scope.end));
  assert.ok(r.scenarios.every(p=>p.period.start>=scope.start&&p.period.end_exclusive<=scope.end));
});
test('B02 simulation recalculates approved saturation formula, same assumptions for both arms',()=>{
  const r=tools.call('budget_inputs',{},scope);
  const request={baselineId:r.scenarios[0].record_id,candidateId:r.scenarios[1].record_id,modelId:r.models[0].record_id,policyId:r.policies[0].record_id};
  const sim=tools.call('simulate',request,scope);
  const m=r.models[0],param=Object.fromEntries(m.parameters.map(p=>[p.name,p.value]));
  for(const arm of ['baseline','candidate']){
    const raw=r.scenarios.find(s=>s.record_id===request[arm+'Id']);
    const expected=raw.allocations.reduce((sum,a)=>sum+Number(param.scale)*Number(a.amount.amount)/(Number(param.saturation)+Number(a.amount.amount)),0);
    assert.ok(Math.abs(Number(sim[arm].expected)-expected)<0.000001);
  }
  assert.equal(sim.kind,'assumption_simulation');assert.equal(sim.realExecutionAllowed,false);
});
test('B03 absent/wrong-scope model and incompatible scenario are held',()=>{
  const r=tools.call('budget_inputs',{},scope);
  const req={baselineId:r.scenarios[0].record_id,candidateId:r.scenarios[1].record_id,modelId:r.models[0].record_id,policyId:r.policies[0].record_id};
  for(const change of [{modelId:'missing'},{candidateId:rawRows('T39').find(r=>r.scope_id==='D007-JP-sample'&&r.record_kind==='budget_scenario').record_id},{policyId:rawRows('T40')[0].record_id}]){
    assert.throws(()=>tools.call('simulate',{...req,...change},scope),e=>e.code==='budget_incompatible');
  }
});
