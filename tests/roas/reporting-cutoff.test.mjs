import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../../frontend/roas/training-dashboard.tsx',import.meta.url),'utf8');
test('dashboard reporting cutoff stays on the existing initial snapshot without a selector',()=>{
 assert(!ui.includes('aria-label="보고 기준시점"'),'reporting cutoff selector must be removed');
 assert(!ui.includes('보고 기준시점을 바꿔'),'case instructions must not refer to the removed selector');
 assert(!ui.includes('setSnapshot'),'reporting cutoff must not remain mutable UI state');
 assert.match(ui,/const snapshot='initial'/,'keep the existing default cutoff');
 assert(ui.includes('training-${caseId}-${snapshot}.json'),'performance uses the fixed snapshot');
 assert(ui.includes('review-${caseId}-${snapshot}.json'),'reviews use the same snapshot');
 assert(ui.includes('snapshot={snapshot}'),'chat uses the same snapshot');
});
