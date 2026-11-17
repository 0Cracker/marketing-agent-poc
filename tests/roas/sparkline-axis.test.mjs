import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../../frontend/roas/training-dashboard.tsx',import.meta.url),'utf8');

test('small trend charts show the analysis start and end dates and explain the dashed line',()=>{
 assert.match(source,/mini&&series\.length>0&&<div className="training-sparkline-axis" aria-hidden="true"><span>\{series\[0\]\.currentDate/);
 assert.match(source,/series\[series\.length-1\]\.currentDate/);
 assert.match(source,/점선은 직전 14일의 같은 요일입니다/);
 assert.match(source,/기울기로 변화 크기를 비교하지 말고/);
});
