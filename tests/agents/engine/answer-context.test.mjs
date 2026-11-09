import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {setTimeout as wait} from 'node:timers/promises';
import {buildAnswerInput} from '../../../backend/roas/engine/answer-context.mjs';
import {createRunEngine} from '../../../backend/roas/engine/index.mjs';
import {createMockProviderPool} from '../../../backend/roas/mock-provider.mjs';
import {createProviderPool} from '../../../backend/roas/providers/index.mjs';
import {createToolRuntime} from '../../../backend/roas/tools/index.mjs';
import {trainingScreenData} from '../../../scripts/roas/training-data.mjs';

const data=trainingScreenData(undefined,'S16','initial');
const scope={caseId:'S16',snapshot:'initial',
  dataHash:createHash('sha256').update(JSON.stringify(data)).digest('hex'),
  filters:{channel:'all',source:'all',campaignId:'all',device:'all'}};
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const withoutEvidence=value=>JSON.parse(JSON.stringify(value,(key,entry)=>
  ['evidenceId','evidenceIds'].includes(key)?undefined:entry));
const noPrivateFields=input=>{
  const body=JSON.stringify(input);
  assert.doesNotMatch(body,/"(?:evidenceId|evidenceIds|sourceRecordIds|sourceVersion|sourceHash|dataHash|nextOffset)"\s*:/);
};

async function fullResults(){
  const runtime=await createToolRuntime({runId:'compact-answer-test',scope});
  try {
    const jobs=[
      ['overview',{scopeRole:'primary'}],
      ['metric_breakdown',{metric:'roas',dimension:'campaign',scopeRole:'primary',limit:3}],
      ['trend',{metrics:['roas'],periodId:'both',granularity:'day',scopeRole:'primary'}],
      ['records',{scopeRole:'primary'}],
      ['trend',{metrics:['roas'],periodId:'both',granularity:'day',scopeRole:'primary',offset:24}],
      ['records',{scopeRole:'primary',offset:24}],
      ['metric_breakdown',{metric:'roas',dimension:'campaign',scopeRole:'primary',offset:3,limit:3}]
    ];
    return await Promise.all(jobs.map(async ([name,args])=>({
      name,args,result:await runtime.execute({name,args})
    })));
  } finally{await runtime.dispose();}
}

test('S16 answers join pages without changing metric values or operating records',async()=>{
  const raw=await fullResults();
  const output=buildAnswerInput({question:'S16 캠페인 성과 분석',scope,results:raw});
  noPrivateFields(output);
  assert.equal(output.results.length,4);
  assert.equal(output.reportingBasis.periods.length,2);
  const overview=output.results.find(item=>item.name==='overview').result;
  const detail=output.results.find(item=>item.name==='metric_breakdown').result;
  const trend=output.results.find(item=>item.name==='trend').result;
  const records=output.results.find(item=>item.name==='records').result;
  assert.equal(trend.days.length,28);
  assert.equal(records.records.length,33);
  assert.equal(detail.groups.length,6);
  assert.equal(trend.coverage,undefined);
  assert.equal(records.coverage,undefined);
  assert.deepEqual(overview.periods,withoutEvidence(raw[0].result.periods));
  assert.equal(detail.periods,undefined);
  assert.deepEqual(detail.groups,withoutEvidence([raw[1],raw[6]].flatMap(item=>item.result.groups)));
  const rawDays=[raw[2],raw[4]].flatMap(item=>item.result.days);
  assert(rawDays.every(day=>day.totals&&day.components.roas));
  const expectedDays=withoutEvidence(rawDays);
  for(const day of expectedDays)delete day.totals;
  assert.deepEqual(trend.days,expectedDays);
  assert(rawDays.every(day=>day.totals));
  assert.deepEqual(records.records,withoutEvidence([raw[3],raw[5]].flatMap(item=>item.result.records)));
  assert(bytes(output)<bytes({scope,results:raw}));
});

test('missing page retains coverage and distinct filters are never merged',async()=>{
  const raw=await fullResults();
  const missing=buildAnswerInput({scope,results:raw.slice(0,4)});
  const trend=missing.results.find(item=>item.name==='trend').result;
  const records=missing.results.find(item=>item.name==='records').result;
  assert.deepEqual(trend.coverage,{returned:24,total:28,incomplete:true,moreAvailable:true});
  assert.deepEqual(records.coverage,{returned:24,total:33,incomplete:true,moreAvailable:true});
  assert.match(trend.limitations.join(' '),/일부 날짜/u);
  const differing={...raw[2],args:{...raw[2].args,periodId:'current'}};
  const split=buildAnswerInput({scope,results:[raw[2],differing]});
  assert.equal(split.results.length,2);
  assert.equal(split.results[0].args.periodId,'both');
  assert.equal(split.results[1].args.periodId,'current');
});

test('overlapping review pages keep the original order and a completed empty lookup has no coverage warning',async()=>{
  const runtime=await createToolRuntime({runId:'answer-coverage-test',scope});
  async function read(name,filters) {
    const args={scopeRole:'primary',...filters};
    return {name,args,result:await runtime.execute({name,args})};
  }
  try {
    const [last,first,overlap,second,empty]=await Promise.all([
      read('review_records',{offset:48}),read('review_records',{}),
      read('review_records',{offset:12}),read('review_records',{offset:24}),
      read('records',{query:'no-existing-record-x82319'})
    ]);
    const {results}=buildAnswerInput({scope,results:[last,first,overlap,second,empty]});
    const [review,records]=results.map(item=>item.result);
    assert.deepEqual(review.reviews,withoutEvidence([first,second,last].flatMap(page=>page.result.reviews)));
    assert.equal(review.reviews.length,60);
    assert.equal(review.coverage,undefined);
    assert.equal(records.status,'empty');
    assert.equal(records.total,0);
    assert.equal(records.coverage,undefined);
  } finally{await runtime.dispose();}
});

async function runEngine(workflow,question,id,check){
  const pool=createMockProviderPool();
  const calls=[];
  const engine=createRunEngine({workflow,toolRuntimeFactory:createToolRuntime,providerPool:{
    ...pool,
    async invokeOnce(params) {
      if(params.format==='markdown') {
        calls.push(params);
        noPrivateFields(params.input);
        assert(!('catalog' in params.input));
        assert(!('toolSchemas' in params.input));
        check(params.input,params.instruction);
        return {output:'ROAS 조회 결과'};
      }
      return pool.invokeOnce(params);
    }
  }});
  const {runId}=await engine.start({question,scope,threadId:id,clientRequestId:id});
  for(let i=0;i<300;i++) {
    const state=await engine.getRun({runId});
    if(state.terminalAt) {
      assert.equal(state.executionStatus,'completed',state.stopReason);
      assert.equal(state.result.answer,'ROAS 조회 결과');
      assert.equal(calls.length,1);
      assert(state.result.evidenceIds.length>0,'server evidence registry stays intact');
      return;
    }
    await wait(10);
  }
  assert.fail('run did not complete');
}

test('Jev Quick and Deep send the route, data and matching answer guidance',async()=>{
  await runEngine('jev','현재 ROAS 알려줘','compact-jev-quick',(input,instruction)=>{
    assert.equal(input.route,'quick');
    assert.equal(input.results[0].name,'overview');
    assert.equal(typeof input.results[0].result.periods[1].display.roas,'string');
    assert.match(instruction,/route가 quick이면 요청한 값이나 비교만 한두 문장/);
  });
  await runEngine('jev','캠페인별 ROAS를 분석해줘','compact-jev-deep',(input,instruction)=>{
    assert.equal(input.route,'deep');
    assert.equal(input.results.find(item=>item.name==='metric_breakdown').result.groups.length,6);
    assert.match(instruction,/route가 deep이면[\s\S]*주요 요인과 판단 근거[\s\S]*개선 우선순위와 확인 방법/);
    assert.match(instruction,/개선 여부를\s*판단할 지표와 비교 기준/);
    assert.match(instruction,/직접적 인과 증거 없이 원인을 확정하지 않는다/);
  });
});

test('standard Quick and Deep also send the route and data to final generation',async()=>{
  await runEngine(undefined,'현재 ROAS 알려줘','compact-standard-quick',input=>{
    assert.equal(input.route,'quick');
    assert.equal(input.results[0].name,'overview');
  });
  await runEngine(undefined,'캠페인별 ROAS를 분석해줘','compact-standard-deep',input=>{
    assert.equal(input.route,'deep');
    assert.equal(input.results.find(item=>item.name==='metric_detail').result.groups.length,6);
  });
});

test('full Jev retrieval reaches the provider unchanged beyond both old size limits',async()=>{
  const raw=[];
  let prompt;
  const selected=new Set(['need_overview','need_trend','need_records','need_review_summary','need_review_records']);
  const pool=createProviderPool({
    env:{JEV_API_KEY:'test-jev',GEMINI_API_KEY:'test-gemini'},
    async fetchImpl(_url,{body}) {
      const request=JSON.parse(body);
      if(request.questions) {
        const answers=Object.fromEntries(Object.entries(request.questions).map(([id,question])=>{
          if(question.type==='noul')return [id,{type:'noul',noul:Number(selected.has(id)||id.startsWith('metric_'))}];
          const choice=id==='route'?'deep':id==='metric_scope'?'catalog':'both';
          return [id,{type:'choice',choice,confidence:1,probabilities:Object.fromEntries(Object.keys(question.criteria)
            .map(key=>[key,Number(key===choice)]))}];
        }));
        return new Response(JSON.stringify({answers}));
      }
      prompt=request.contents[0].parts[0].text;
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'검증용 답변'}]}}]}));
    }
  });
  const engine=createRunEngine({workflow:'jev',providerPool:pool,async toolRuntimeFactory(params) {
    const runtime=await createToolRuntime(params);
    return {...runtime,async execute(job) {
      const result=await runtime.execute(job);
      raw.push({...job,result});
      return result;
    }};
  }});
  const {runId}=await engine.start({scope,question:'일별 지표, 운영 기록과 리뷰를 함께 분석해줘',
    threadId:'full-data',clientRequestId:'full-data'});
  let run;
  for(let i=0;i<500;i++) {
    run=await engine.getRun({runId});
    if(run.terminalAt)break;
    await wait(10);
  }
  assert.equal(run.executionStatus,'completed',run.stopReason);
  assert(run.usage.resultBytes>100*1024);
  assert(prompt.length>120000);
  const input=JSON.parse(prompt);
  noPrivateFields(input);
  assert.equal(input.scope.periods,undefined);
  for(const [name,field,count] of [['trend','days',28],['records','records',33],['review_records','reviews',60]]) {
    const result=input.results.find(item=>item.name===name).result;
    const pages=raw.filter(item=>item.name===name).sort((a,b)=>(a.args.offset??0)-(b.args.offset??0));
    assert.equal(result[field].length,count);
    if(name==='trend') {
      assert(pages[0].args.metrics.length>1);
      assert(result.days.every(day=>day.totals));
    }
    assert.deepEqual(result[field],withoutEvidence(pages.flatMap(page=>page.result[field])));
    assert.equal(result.truncated,undefined);
    assert.equal(result.coverage,undefined);
  }
  assert.deepEqual(input.results.find(item=>item.name==='review_summary').result.periods,
    withoutEvidence(raw.find(item=>item.name==='review_summary').result.periods));
});
