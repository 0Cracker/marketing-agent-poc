import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CASES,normalizedJob,checkClassification,runClassificationDiagnostics} from '../../../scripts/roas/diagnostics/jev-classification.mjs';

test('classification-only mock runs real engine and tools without any external generation',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'jev-classification-'));
  try{
    const report=await runClassificationDiagnostics({root,args:[]});
    assert.equal(report.passed,true);
    assert.equal(report.mode,'mock_fixed_generation');
    assert.equal(report.realJevAttempts,0);
    assert.equal(report.externalGenerationCalls,0);
    assert(report.jevAttempts<=27);
    assert(CASES.every(item=>report.runs.some(run=>run.id===item.id&&run.passed)));
    assert(report.runs.every(run=>run.fixedGenerationCalls===1));
    const deep=report.runs.find(run=>run.id==='deep');
    assert.deepEqual(deep.questionCounts,[24,11]);
    assert.deepEqual(deep.queryCounts.filter(item=>item.tool==='trend').map(item=>item.returned),[24,4]);
    assert.deepEqual(deep.queryCounts.filter(item=>item.tool==='records').map(item=>item.returned),[24,9]);
    assert.equal(report.comparison.deep.confirmed,false,'mock timings are not real-world timings');
    assert(fs.existsSync(path.join(root,'evidence')));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('verification mode skips old replay and keeps Jev attempts below 12',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'jev-verify-'));
  try {
    const report=await runClassificationDiagnostics({root,args:['--verify-only']});
    assert.equal(report.passed,true);
    assert.equal(report.replays.length,0);
    assert.equal(report.runs.length,6);
    assert(report.jevAttempts<=12);
    assert.equal(report.externalGenerationCalls,0);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('argument comparison ignores pagination and ordering but detects metric / dimension / period mismatches',()=>{
  const scenario=CASES.find(item=>item.id==='paired');
  const first={route:'quick',selected:['metric_breakdown'],metrics:['roas','cvr']};
  const scope={caseId:'S16',snapshot:'initial',filters:{channel:'all',source:'all',campaignId:'all',device:'all'}};
  const entries=scenario.calls.map(([name,args])=>({job:{name,args:{scopeRole:'primary',limit:2,offset:0,...args}},
    result:{status:'ready',groups:[{key:'a'},{key:'b'}]}}));
  const invocations=[{},{}];
  assert.equal(checkClassification(scenario,{first,tools:entries,scope,invocations}).passed,true);
  const mistaken=structuredClone(entries);
  mistaken[1].job.args.dimension='campaign';
  assert(checkClassification(scenario,{first,tools:mistaken,scope,invocations}).failures
    .some(error=>error.kind==='second_pair_period'));
  const wrongMetric=checkClassification(scenario,{first:{...first,metrics:['roas']},tools:entries,scope,invocations});
  assert(wrongMetric.failures.some(error=>error.kind==='first_metric'));
  assert.equal(normalizedJob({name:'trend',args:{scopeRole:'primary',offset:24,metrics:['cvr']}}),
    normalizedJob({name:'trend',args:{metrics:['cvr'],scopeRole:'primary',offset:0}}));
});

test('unsupported CAC cannot be silently replaced with CPA or ROAS',()=>{
  const scenario=CASES.find(item=>item.id==='unsupported');
  const scope={caseId:'S16',snapshot:'initial',filters:{channel:'all',source:'all',campaignId:'all',device:'all'}};
  const verdict=checkClassification(scenario,{first:{route:'quick',scope:'unresolved',selected:[],metrics:[]},
    scope,invocations:[{}],tools:[{job:{name:'metric_components',args:{scopeRole:'primary',metric:'cpa'}},result:{status:'ready'}}]});
  assert(verdict.failures.some(error=>error.kind==='unsupported_scope'));
});
