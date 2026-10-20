import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCurrentData} from '../../../marketing-dashboard-drafts/scripts/current-data.mjs';
import {CatalogTools,budgetResponseParameters} from '../../backend/agent-tools.mjs';

test('Hill channel budget model rejects incomplete, duplicate and unknown parameters',()=>{
  for(const parameters of [[{name:'search.scale',value:'60'}],[{name:'scale',value:'40'},{name:'scale',value:'40'}],[{name:'other.scale',value:'3'}],[{name:'scale',value:'40'},{name:'saturation',value:'0'}]])
    assert.throws(()=>budgetResponseParameters(parameters),e=>e.code==='model_unsupported');
});

test('CURRENT Hill model aggregates each channel once and matches stored scenario projections',()=>{
  const {manifest,catalog}=loadCurrentData();
  const entries=catalog.records.map(record=>({batch:'CURRENT',country:record.dataset_type==='T01'?'GLOBAL':record.scope_id.split('-')[1],record,payload:record,schema_conforming:true}));
  const tools=new CatalogTools(entries,{manifest});
  for(const country of ['KR','JP','US']){
    const scope={batch:'CURRENT',country,scopeId:'CURRENT-'+country,productIds:['P1A','P1B','P2A','P2B','P3A','P3B'],start:'2026-08-01',end:'2026-09-01',asOf:manifest.source_created_at,dataHash:manifest.data_sha256};
    const inputs=tools.call('budget_inputs',{},scope),model=inputs.models[0];
    assert.equal(model.model_version,'Hill-slope1-demo-20261020');
    for(const scenario of inputs.scenarios){
      const args={baselineId:inputs.scenarios[0].record_id,candidateId:scenario.record_id,modelId:model.record_id,policyId:inputs.policies[0].record_id};
      const simulation=tools.call('simulate',args,scope);
      assert.equal(simulation.responseAggregation,'channel');assert.equal(simulation.realExecutionAllowed,false);
      assert.equal(Number(simulation.candidate.expected),scenario.expected_measures.find(m=>m.metric_id.endsWith('.expected_conversions')).value);
      const grouped=new Map();for(const a of simulation.candidate.allocations){const channel=simulation.candidate.campaignChannels[a.campaign_ref];grouped.set(channel,(grouped.get(channel)||0)+Number(a.amount.amount));}
      const total={KR:15000000,JP:1500000,US:15000}[country];
      // An independent numeric oracle complements the Decimal source readback.
      const expected=60*grouped.get('search')/(total*.2+grouped.get('search'))+40*grouped.get('social')/(total*.1+grouped.get('social'));
      assert(Math.abs(Number(simulation.candidate.expected)-expected)<0.00000051);
      if(scenario!==inputs.scenarios[0])continue;
      // Split the first allocation between two existing campaigns in the same channel.
      const first=scenario.allocations[0],campaign=entries.find(e=>e.record.campaign_id===first.campaign_ref).record;
      const peer=entries.find(e=>e.record.dataset_type==='T12'&&e.country===country&&e.record.channel===campaign.channel&&e.record.campaign_id!==campaign.campaign_id).record;
      const copy=structuredClone(entries),target=copy.find(e=>e.record.record_id===scenario.record_id).record;
      const amount=Number(first.amount.amount)/2;
      const half={...first,amount:{...first.amount,amount:amount.toFixed(2)},lower:{...first.lower,amount:'0.00'}};
      target.allocations=[half,{...half,campaign_ref:peer.campaign_id},...target.allocations.slice(1)];
      const changed=new CatalogTools(copy,{manifest}),split=changed.call('simulate',{...args,baselineId:scenario.record_id},scope);
      assert.equal(split.candidate.expected,simulation.candidate.expected,'Campaign splitting must not multiply channel maximum');
    }
  }
});
