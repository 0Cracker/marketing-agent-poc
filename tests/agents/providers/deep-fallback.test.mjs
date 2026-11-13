import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderPool} from '../../../backend/roas/providers/index.mjs';

const pool = createProviderPool({env:{
  GEMINI_API_KEY:'test-key',
  AI_GATEWAY_API_KEY:'test-key',
  SAIL_API_KEY:'test-key'
}});

test('Deep prioritizes Flash then Gateway GLM then Sail GLM, without Flash-Lite',()=>{
  for(const role of ['deep_reasoning','deep_final']){
    assert.deepEqual(pool.eligibleCandidates({role}).map(x=>x.id),
      ['gemini-deep','gateway-lite','sail-open']);
  }
});

test('Quick retains Flash-Lite as its primary answer model',()=>{
  assert.deepEqual(pool.eligibleCandidates({role:'quick_answer'}).map(x=>x.id),
    ['gemini-lite','gateway-lite','sail-open']);
});

test('Deep starts at Gateway GLM if Gemini key is missing',()=>{
  const noGemini=createProviderPool({env:{
    AI_GATEWAY_API_KEY:'test-key',
    SAIL_API_KEY:'test-key'
  }});
  assert.deepEqual(noGemini.eligibleCandidates({role:'deep_final'}).map(x=>x.id),
    ['gateway-lite','sail-open']);
});