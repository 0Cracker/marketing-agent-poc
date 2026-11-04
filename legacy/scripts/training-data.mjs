import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {currentManifest, dataDirectory, sha256} from './current-data.mjs';
import {trainingCaseIds, trainingMeasures} from '../shared/training-dashboard.mjs';

const snapshots = [{id:'initial',label:'2026.08.31 기준',asOf:'2026-08-31T00:00:00+09:00'},{id:'mature',label:'2026.09.07 기준',asOf:'2026-09-07T00:00:00+09:00'}];
let cache;
function load(directory) {
  const manifest=currentManifest(directory);
  const entry=manifest.metadata.find(file=>file.file==='training-dashboard.json');
  assert(entry?.public===false && entry.contract==='roas-training/1','training_metadata_not_registered');
  const source=path.join(directory,entry.file),stat=fs.statSync(source);
  if(!cache || cache.hash!==entry.sha256 || cache.source!==source || cache.modified!==stat.mtimeMs || cache.size!==stat.size) {
    const bytes=fs.readFileSync(source);
    assert.equal(sha256(bytes),entry.sha256,'training_data_hash_mismatch');
    const payload=JSON.parse(bytes.toString());
    assert.equal(payload.contract,'roas-training/1');
    assert.deepEqual(payload.cases.map(item=>item.caseId),trainingCaseIds);
    const keys=Object.keys(payload.cases[0].facts[0]).sort();
    for(const pack of [...payload.cases,...Object.values(payload.matureOverrides)]) {
      assert.equal(pack.facts.length,336);assert.equal(pack.breakdowns.length,1680);
      for(const row of pack.facts) {
        assert.deepEqual(Object.keys(row).sort(),keys,'training_fact_schema_differs');
        assert(trainingMeasures.every(key=>Number.isSafeInteger(row[key])&&row[key]>=0),'training_measure_invalid');
        assert(row.impressions>=row.clicks && row.clicks>=row.sessions && row.sessions>=row.view && row.view>=row.cart && row.cart>=row.checkout && row.checkout>=row.purchases,'training_funnel_invalid');
        assert.equal(row.purchases+row.returnPurchases,row.orders);assert.equal(row.listRevenue-row.discount,row.revenue);
      }
    }
    cache={hash:entry.sha256,payload,source,modified:stat.mtimeMs,size:stat.size};
  }
  return {...cache,manifest};
}
export function trainingIndex(directory=dataDirectory) {
  const {payload,manifest}=load(directory);
  return {contract:payload.contract,dataHash:manifest.data_sha256,cases:payload.cases.map(item=>({id:item.caseId,label:item.label})),snapshots};
}
export function trainingScreenData(directory=dataDirectory,caseId='S01',snapshot='initial') {
  assert(trainingCaseIds.includes(caseId),'training_case_not_registered');
  const cutoff=snapshots.find(item=>item.id===snapshot);assert(cutoff,'training_snapshot_invalid');
  const {payload,manifest}=load(directory);
  const source=(snapshot==='mature'&&payload.matureOverrides[caseId])||payload.cases.find(item=>item.caseId===caseId);
  const {recordIds,...pack}=source;
  const wanted=new Set(recordIds),records=payload.records.filter(row=>wanted.has(row.id));
  assert.equal(records.length,wanted.size,'training_record_reference_missing');
  return {...pack,asOf:cutoff.asOf,dataHash:manifest.data_sha256,records};
}
export const trainingAssetNames = ['training-index.json',...trainingCaseIds.flatMap(id=>snapshots.map(snapshot=>`training-${id}-${snapshot.id}.json`))];
export function trainingAsset(file,directory=dataDirectory) {
  if(file==='training-index.json') return trainingIndex(directory);
  const match=/^training-(S\d{2})-(initial|mature)\.json$/.exec(file);
  assert(match && trainingAssetNames.includes(file),'training_asset_invalid');
  return trainingScreenData(directory,match[1],match[2]);
}
