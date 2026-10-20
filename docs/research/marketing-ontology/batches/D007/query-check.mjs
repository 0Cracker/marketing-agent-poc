import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadCatalog,select,summarize} from './catalog.mjs';

const catalog=loadCatalog(),byId=new Map(catalog.map(x=>[x.record.record_id,x.record]));
assert.equal(catalog.length,22242);
assert.throws(()=>select(catalog,{asOf:'invalid-date'}),/timestamp required/);
assert.equal(summarize(catalog,{batch:'D007',type:'T24',field:'rating_value',scope:'D007-JP-sample',asOf:'2026-10-16T00:00:00Z'}).groups.length,0);
const ratings=summarize(catalog,{batch:'D007',type:'T24',field:'rating_value',scope:'D007-JP-sample'}).groups;
assert.equal(ratings.length,6);assert.ok(ratings.every(g=>g.numeric_summary.count===100));
const indexes=summarize(catalog,{batch:'D007',type:'T05',country:'KR',field:'index_value'}).groups;
assert.equal(indexes.length,72);assert.ok(indexes.every(g=>new Set(g.records.map(id=>byId.get(id).normalization_scope)).size===1));
const experiments=summarize(catalog,{batch:'D007',type:'T38',country:'KR',field:'outcome_measures.0.value'}).groups;
assert.equal(experiments.length,24);assert.ok(experiments.every(g=>new Set(g.records.map(id=>byId.get(id).experiment_id+'/'+byId.get(id).arm_id)).size===1));
const report={status:'pass',catalog_rows:catalog.length,checks:['invalid_timestamp_rejected','future_source_excluded','country_scope_and_rating_scale_preserved',
 'independent_normalization_scopes_separated','experiments_and_arms_separated','nested_metric_definition_preserved'],
 review_groups:ratings.length,search_groups:indexes.length,experiment_arm_groups:experiments.length};
const i=process.argv.indexOf('--output');if(i!==-1){assert.ok(process.argv[i+1]);fs.writeFileSync(process.argv[i+1],JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify(report));
