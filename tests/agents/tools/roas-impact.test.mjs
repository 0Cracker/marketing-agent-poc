import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createToolRuntime} from '../../../backend/roas/tools/index.mjs';
import {roasImpactPp,roasScopeDeltaPp} from '../../../shared/roas/roas-impact.mjs';
import {analysisRows,analyzeGroups} from '../../../frontend/roas/training-analysis.ts';
import {trainingScreenData} from '../../../scripts/roas/training-data.mjs';

const data=trainingScreenData(undefined,'S16','initial');
const filters={channel:'all',source:'all',campaignId:'all',device:'all'};
const scope={caseId:'S16',snapshot:'initial',filters,
  dataHash:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
const within=(a,b,epsilon=1e-7)=>assert(Math.abs(a-b)<epsilon,`expected ${a} ≈ ${b}`);
const runtime=async(extra={})=>createToolRuntime({scope,runId:'impact-test',...extra});

test('S16 ROAS impacts add to total scope change and match the dashboard calculation',async()=>{
  const tools=await runtime();
  try {
    const result=await tools.execute({name:'metric_breakdown',args:{scopeRole:'primary',metric:'roas',dimension:'campaign'}});
    assert.equal(result.status,'ready');
    assert.equal(result.groups.length,6);
    within(result.scopeDeltaPp,-71.07217474);
    within(result.groups.reduce((sum,group)=>sum+group.impactPp,0),result.scopeDeltaPp);
    const top=[...result.groups].sort((a,b)=>a.impactPp-b.impactPp);
    assert.match(top[0].label,/검색 A$/);
    assert.match(top[1].label,/Facebook 피드$/);
    within(top[0].impactPp,-26.54,0.01);
    within(top[1].impactPp,-25.84,0.01);

    const dashboard=analyzeGroups(data,analysisRows(data,filters,'roas','campaignUnit'),'roas','campaignUnit');
    for(const group of result.groups){
      const screenGroup=dashboard.groups.find(row=>row.key===group.key);
      assert(screenGroup);
      within(group.impactPp,screenGroup.impact*100);
    }
  } finally {await tools.dispose();}
});

test('pagination preserves full-scope denominators and only ROAS campaign contains contributions',async()=>{
  const tools=await runtime();
  try {
    const get=async(args)=>tools.execute({name:'metric_breakdown',
      args:{scopeRole:'primary',metric:'roas',dimension:'campaign',...args}});
    const all=await get({});
    const first=await get({limit:2});
    const second=await get({offset:2,limit:2});
    const last=await get({offset:4,limit:2});
    assert.deepEqual([first.nextOffset,second.nextOffset,last.nextOffset],[2,4,null]);
    for(const page of [first,second,last]) {
      within(page.scopeDeltaPp,all.scopeDeltaPp);
      for(const group of page.groups)within(group.impactPp,all.groups.find(row=>row.key===group.key).impactPp);
    }
    const others=await tools.execute({name:'metric_breakdown',
      args:{scopeRole:'primary',metric:'cvr',dimension:'campaign'}});
    assert.equal(Object.hasOwn(others,'scopeDeltaPp'),false);
    assert.equal(Object.hasOwn(others.groups[0],'impactPp'),false);
    const roasDevice=await tools.execute({name:'metric_breakdown',
      args:{scopeRole:'primary',metric:'roas',dimension:'device'}});
    assert.equal(Object.hasOwn(roasDevice,'scopeDeltaPp'),false);
  } finally {await tools.dispose();}
});

test('zero total spend in either period returns null for every impact field',async()=>{
  assert.equal(roasScopeDeltaPp({revenue:10,spend:0},{revenue:15,spend:10}),null);
  assert.equal(roasImpactPp({revenue:10,spend:10},{revenue:15,spend:0},
    {revenue:10,spend:1},{revenue:15,spend:2}),null);
  for(const period of ['baseline','current']){
    const modified=structuredClone(data);
    for(const row of modified.facts)if(row.periodId===period)row.spend=0;
    const tools=await runtime({sourceLoader:async()=>({data:modified,review:{status:'not_provided',reviews:[]}})});
    try {
      const result=await tools.execute({name:'metric_breakdown',
        args:{scopeRole:'primary',metric:'roas',dimension:'campaign'}});
      assert.equal(result.status,'ready');
      assert.equal(result.scopeDeltaPp,null);
      assert(result.groups.every(group=>group.impactPp===null));
    } finally {await tools.dispose();}
  }
});
