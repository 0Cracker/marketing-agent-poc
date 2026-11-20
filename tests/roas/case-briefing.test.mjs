import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trainingCaseIds} from '../../shared/roas/training-dashboard.mjs';

const source=fs.readFileSync(new URL('../../frontend/roas/training-dashboard.tsx',import.meta.url),'utf8');

test('overview shows recommended exploration steps and keeps case hints folded',()=>{
 assert.match(source,/\{!selectedMetric&&<CaseBriefing caseId=\{caseId\}\/>\}/);
 const briefing=source.slice(source.indexOf('function CaseBriefing'),source.indexOf('function RevenueSpendSummary'));
 assert.equal([...briefing.matchAll(/<li>/g)].length,3);
 assert.match(briefing,/<details><summary>사례 \{caseId\} 설명 보기, 조사 단서 포함<\/summary><p>\{caseDescriptions\[caseId\]\}<\/p><\/details>/);
 assert.doesNotMatch(briefing,/<details open/);
});

test('every case has a description for the briefing',()=>{
 const block=source.slice(source.indexOf('const caseDescriptions'),source.indexOf('};',source.indexOf('const caseDescriptions')));
 for(const caseId of trainingCaseIds)assert.match(block,new RegExp(`\\b${caseId}:'`),caseId);
});
