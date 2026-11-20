import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('connection footnote states the actual state instead of an ambiguous offline check',()=>{
 const conversation=fs.readFileSync(new URL('../../../frontend/roas/roas-conversation.tsx',import.meta.url),'utf8');
 const answer=fs.readFileSync(new URL('../../../frontend/roas/roas-answer.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(conversation+answer,/오프라인 연결 확인/);
 assert.match(conversation,/연결됨, 로컬 대체 응답 모드: 실제 AI 모델을 호출하지 않습니다\./);
 assert.match(answer,/'로컬 대체 응답'/);
});
