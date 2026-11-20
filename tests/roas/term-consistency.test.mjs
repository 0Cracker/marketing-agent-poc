import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const sources=['../../frontend/roas/training-dashboard.tsx','../../frontend/roas/roas-examples.ts','../../shared/roas/roas-chat.mjs','../../frontend/roas/training-analysis.ts'].map(read).join('\n');

test('attributed revenue uses one name across dashboard, examples, chat and tables',()=>{
 assert.doesNotMatch(sources,/구매 전환 매출/);
 assert.match(sources,/귀속 구매 매출/);
});

test('CVR card and funnel explain their different denominators',()=>{
 const dashboard=read('../../frontend/roas/training-dashboard.tsx');
 assert.match(dashboard,/metric\.key==='cvr'&&<small className="training-indicator-basis">클릭 기준<\/small>/);
 assert.match(dashboard,/이 퍼널은 랜딩 세션 기준이라 위의 클릭 기준 CVR과 분모가 다릅니다/);
});
