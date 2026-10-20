import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCurrentData} from '../../../marketing-dashboard-drafts/scripts/current-data.mjs';
import {CatalogTools,digest} from '../../backend/agent-tools.mjs';

test('CURRENT dummy acquisition time never hides facts, relations, evidence or budget inputs',()=>{
  const {catalog,manifest}=loadCurrentData(),before=digest(catalog);
  const tools=new CatalogTools(catalog.records.map(record=>({batch:'CURRENT',country:record.dataset_type==='T01'?'GLOBAL':record.scope_id.split('-')[1],record,payload:record,schema_conforming:true})),{manifest});
  for(const country of ['KR','JP','US']){
    const scope={batch:'CURRENT',country,scopeId:'CURRENT-'+country,productIds:['P1A','P1B','P2A','P2B','P3A','P3B'],start:'2026-08-01',end:'2026-09-01',asOf:manifest.source_created_at,dataHash:manifest.data_sha256},early={...scope,asOf:'2020-01-01T00:00:00Z'};
    assert.deepEqual(tools.quality(early),tools.quality(scope));
    const requests=[['market_compare',{}],...['T08','T13','T22'].map(type=>['observations',{type,limit:80}]),...['price','stock','media','measurement'].map(candidate=>['relations',{candidate}]),['budget_inputs',{}]];
    for(const [name,args] of requests){
      const current=tools.call(name,args,scope),past=tools.call(name,args,early);assert.deepEqual(past,current,`${country} ${name} ${JSON.stringify(args)}`);
      if(current.recordIds?.length)assert.deepEqual(tools.call('evidence',{ids:current.recordIds.slice(0,24)},early),tools.call('evidence',{ids:current.recordIds.slice(0,24)},scope));
    }
    const budget=tools.call('budget_inputs',{},scope),args={baselineId:budget.scenarios[0].record_id,candidateId:budget.scenarios[1].record_id,modelId:budget.models[0].record_id,policyId:budget.policies[0].record_id};
    assert.deepEqual(tools.call('simulate',args,early),tools.call('simulate',args,scope));
    assert.throws(()=>tools.call('market_compare',{}, {...early,start:'2020-01-01',end:'2020-02-01'}),e=>e.code==='data_unavailable');
    assert.throws(()=>tools.call('market_compare',{}, {...early,dataHash:'wrong'}),e=>e.code==='inputs_changed');
    const otherCountry=catalog.records.find(r=>r.dataset_type==='T22'&&r.scope_id.split('-')[1]!==country);
    assert.throws(()=>tools.call('evidence',{ids:[otherCountry.record_id]},early),e=>e.code==='evidence_out_of_scope');
  }
  assert.equal(digest(catalog),before);
});
