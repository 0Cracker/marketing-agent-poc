import fs from 'node:fs';
import {loadCurrentData} from './current-data.mjs';
import {analyzeRoasCase} from '../backend/roas-case.mjs';
import {renderRoasReview} from '../backend/roas-review.mjs';

const {catalog, manifest} = loadCurrentData();
const index = process.argv.indexOf('--scenario');
const scenario = index < 0 ? 'D008-comparison-demo' : process.argv[index + 1];
const profiles = catalog.definitions.scenario_profiles || [];
const profile = profiles.find(item => item.scenario_id === scenario) || (scenario === 'D008-comparison-demo' ? {
  scenario_id: scenario, product_id: 'P1A', currency: 'KRW', scope_ids: {KR: manifest.scope_ids.KR},
  baseline: {start: '2026-08-03', end: '2026-08-17'}, observed: {start: '2026-08-17', end: '2026-08-31'}
} : null);
if (!profile) throw Error('scenario_not_registered');
const cutoff = process.argv.indexOf('--as-of');
const result = analyzeRoasCase(catalog.records, profile, {asOf: cutoff < 0 ? profile.default_as_of || '2026-10-21T00:00:00+09:00' : process.argv[cutoff + 1]});
result.dataHash = manifest.data_sha256;
const output = process.argv.indexOf('--output');
if (output >= 0) {
  const target = process.argv[output + 1];
  fs.writeFileSync(target, target.endsWith('.md') ? renderRoasReview(result) : JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
}
console.log(JSON.stringify({scenario: result.scenarioId, status: result.status, gaps: result.gaps,
  periods: result.periods.map(period => ({period: period.period, ...period.total})), actionDrafts: result.actionDrafts.length,
  budgetReview: result.budgetReview, dataHash: result.dataHash}, null, 2));
