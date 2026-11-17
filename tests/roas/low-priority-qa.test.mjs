import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('KPI summary shows the current value before the comparison line',()=>{
 const dashboard=read('../../frontend/roas/training-dashboard.tsx');
 const summary=dashboard.slice(dashboard.indexOf('function MetricSummary'),dashboard.indexOf('const evidenceFieldNames'));
 assert(summary.indexOf('training-roas-value-row')<summary.indexOf('training-roas-direction'));
});

test('review link column is rendered only when a row has a link',()=>{
 const review=read('../../frontend/roas/review-analysis-section.tsx');
 assert.match(review,/const hasLinks=rows\.some\(row=>safeLink\(row\.url\)\);/);
 assert.match(review,/\{hasLinks&&<th scope="col">원문 확인<\/th>\}/);
});

test('record totals explain how the overall count splits',()=>{
 const records=read('../../frontend/roas/operational-records.tsx');
 assert.match(records,/기간 중 변경 \$\{\(records\.length-startRecords\)/);
 assert.match(records,/시작 시점 설정 \$\{startRecords/);
});
