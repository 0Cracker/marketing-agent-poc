import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {formatFact,hypothesisRows,shareSeries} from '../frontend/workbench/agent-presentation.ts';
import type {AgentRun} from '../frontend/workbench/agent-client.ts';

const checked=JSON.parse(fs.readFileSync(new URL('../evidence/v0.4.0/exploration-20261019/marketing-agent-answer-examples-evidence-20261019.json',import.meta.url),'utf8'));
const run={output:{facts:checked.market.map((r:{recordId:string;product:string;share:string})=>({id:r.recordId+'.share',recordId:r.recordId,product:r.product,value:r.share,field:'share',unit:'ratio'})),hypotheses:[{candidate:'price',supports:checked.price.supports,counters:checked.price.counters,assessment:'mixed'}]}} as AgentRun;
test('P01 chart and formatted cards use the same approved values and reference IDs',()=>{
  const series=shareSeries(run);assert.equal(series.length,6);assert.equal(formatFact(run.output!.facts![0]),'3.80%');assert.equal(series[0].share,Number(checked.market[0].share)*100);assert.equal(series[0].recordId,checked.market[0].recordId);
});
test('P02 unreviewed and unclassified candidates never become evidence of no effect',()=>{
  const rows=hypothesisRows(run);assert.equal(rows[0].assessment,'근거 혼재');assert.equal(rows[1].assessment,'미검토');assert.equal(rows[1].classified,false);
  assert.equal(hypothesisRows({output:{hypotheses:[{candidate:'stock',supports:[],counters:[],assessment:'unresolved'}]}})[1].assessment,'자료 확인됨 · 원인 판단 미완료');
});
test('P03 null is not zero; multiple months cannot become duplicated product bars',()=>{
  assert.equal(formatFact({...run.output!.facts![0],value:null}),'미확보');assert.deepEqual(shareSeries({output:{facts:[...run.output!.facts!,run.output!.facts![0]]}} as AgentRun),[]);
});

test('P04 summary distinguishes missing classification from a genuine zero side',()=>{
  const rows=hypothesisRows({output:{hypotheses:[{candidate:'stock',supports:[],counters:[],assessment:'unresolved'},{candidate:'price',supports:[],counters:run.output!.hypotheses![0].counters,assessment:'counter_only'}]}});
  assert.equal(rows[1].summary,'자료 확인됨 · 원인 판단 미완료');assert.equal(rows[2].summary,'미검토');
  assert.equal(rows[0].summary,`지지 0건 · 반대 ${rows[0].counters.length}건`);
  assert.equal(hypothesisRows(run)[0].summary,`지지 ${run.output!.hypotheses![0].supports.length}건 · 반대 ${run.output!.hypotheses![0].counters.length}건`);
  const source=fs.readFileSync(new URL('../frontend/workbench/agent-conversation.tsx',import.meta.url),'utf8');
  assert.ok(source.includes('hypotheses?.slice(0,2).map'));
  assert.ok(source.includes('summaryRows.find(r=>r.candidate===h.candidate)?.summary'));
});
