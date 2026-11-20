import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scopeTargetRoas} from '../../frontend/roas/training-target.ts';
import {trainingScreenData} from '../../scripts/roas/training-data.mjs';
import {trainingCaseIds} from '../../shared/roas/training-dashboard.mjs';

const filters={channel:'all',source:'all',campaignId:'all',device:'all'};

test('existing virtual target ROAS 350% is reused for every case and scope without new data',()=>{
 for(const caseId of trainingCaseIds){
  const data=trainingScreenData(undefined,caseId,'initial');
  const original=JSON.stringify(data);
  assert.equal(scopeTargetRoas(data,filters),3.5,caseId);
  assert.equal(scopeTargetRoas(data,{...filters,campaignId:'EDU-C1'}),3.5,caseId);
  assert.equal(JSON.stringify(data),original,'presentation must not change source data');
 }
});

test('mixed or missing targets are not averaged into a single line',()=>{
 const data=trainingScreenData(undefined,'S16','initial');
 const mixed={...data,campaigns:data.campaigns.map((campaign:Record<string,unknown>,index:number)=>index===0?{...campaign,targetRoas:4}:campaign)};
 assert.equal(scopeTargetRoas(mixed,filters),null);
 assert.equal(scopeTargetRoas(mixed,{...filters,campaignId:'EDU-C1'}),4);
 const missing={...data,campaigns:data.campaigns.map((campaign:Record<string,unknown>)=>({...campaign,targetRoas:undefined}))};
 assert.equal(scopeTargetRoas(missing,filters),null);
});

test('ROAS card and chart render the target only when one exists',()=>{
 const dashboard=fs.readFileSync(new URL('../../frontend/roas/training-dashboard.tsx',import.meta.url),'utf8');
 assert.match(dashboard,/target!==null&&<ReferenceLine y=\{target\}/);
 assert.match(dashboard,/target=\{scopeTargetRoas\(data,filters\)\}/);
 assert.match(dashboard,/'목표 달성':'목표 미달'/);
});
