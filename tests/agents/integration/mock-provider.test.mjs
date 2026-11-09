import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockProviderPool} from '../../../backend/roas/mock-provider.mjs';

test('explicit local mock never accesses real provider transports',async()=>{
  const pool=createMockProviderPool();
  assert.deepEqual(pool.eligibleCandidates().map(item=>item.provider),['mock']);
  const classify=await pool.invokeOnce({instruction:'Choose the FIRST additional data tools',input:{}});
  assert.deepEqual(classify.output.toolCalls,[]);
  const decide=await pool.invokeOnce({instruction:'You decide follow-up tools',input:{}});
  assert.equal(decide.output.decision,'gemini_sufficient');
  const output=await pool.invokeOnce({format:'markdown',instruction:'Markdown',
    input:{results:[{name:'overview',result:{periods:[{id:'current',display:{roas:'250.0%'}}]}}]}});
  assert.match(output.output,/250\.0%/);
});
