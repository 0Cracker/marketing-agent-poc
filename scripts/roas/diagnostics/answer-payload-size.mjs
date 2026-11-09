import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildAnswerInput} from '../../../backend/roas/engine/answer-context.mjs';

const file=process.argv[2]||'evidence/jev-e2e-20261109/run-1794195811884.json';
const trace=JSON.parse(readFileSync(file,'utf8'));
const run=trace.runs[0];
const original=trace.attempts.findLast(attempt=>attempt.format==='markdown').input;
const results=run.tools.map(({job,result})=>({name:job.name,args:job.args,result}));
const input=buildAnswerInput({...original,results});
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const withoutEvidence=value=>JSON.parse(JSON.stringify(value,(key,entry)=>
  ['evidenceId','evidenceIds'].includes(key)?undefined:entry));
const get=(items,name)=>items.find(item=>item.name===name).result;

for(const [name,field,count] of [['metric_detail','groups',6],['trend','days',28],['records','records',33]]) {
  const source=results.filter(item=>item.name===name).sort((a,b)=>(a.args.offset??0)-(b.args.offset??0));
  const expected=withoutEvidence(source.flatMap(item=>item.result[field]));
  if(name==='trend'&&source[0].args.metrics?.length===1&&source[0].args.metrics[0]==='roas') {
    for(const day of expected)delete day.totals;
  }
  const output=get(input.results,name);
  assert.equal(output[field].length,count);
  assert.deepEqual(output[field],expected);
  assert.equal(output.coverage,undefined);
}
assert.deepEqual(get(input.results,'overview').periods,withoutEvidence(get(results,'overview').periods));
assert.equal(input.reportingBasis.periods.length,2);
assert(!/"(evidenceIds?|sourceRecordIds|sourceHash|sourceVersion|dataHash|nextOffset)"\s*:/.test(JSON.stringify(input)));

const before=bytes(original),after=bytes(input);
console.log('FINAL INPUT bytes:',before,'->',after,'saved:',before-after,
  '('+((before-after)/before*100).toFixed(1)+'%)');
console.log('Verified retained data: 2 overview periods, 6 campaign groups, 28 daily metrics, 33 operating records.');
