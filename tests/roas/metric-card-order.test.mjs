import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../../frontend/roas/training-dashboard.tsx',import.meta.url),'utf8');

test('overview cards follow ROAS = AOV × CVR ÷ CPC and demote derived or missing metrics',()=>{
 assert.match(source,/const roasComponentKeys=\['aov','cvr','cpc'\],referenceMetricKeys=\['adCtr','cpa'\];/);
 assert.match(source,/<h3>ROAS 구성 지표<\/h3>[\s\S]*keys=\{roasComponentKeys\}[\s\S]*<h3>참고 지표<\/h3>[\s\S]*keys=\{referenceMetricKeys\}/);
 assert.doesNotMatch(source,/<h3>보조 지표와 추이<\/h3>/);
 assert.doesNotMatch(source,/referenceMetricKeys=\[[^\]]*'cac'/,'CAC has no data and no longer takes a card slot');
 assert.match(source,/CAC는 신규 고객 수가 집계되지 않아 표시하지 않습니다/);
});
