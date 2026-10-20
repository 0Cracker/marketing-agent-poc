// Uses existing approved inputs only. It is safe to run before D007 generation approval.
import assert from 'node:assert/strict';
import {checkSpec,requireApproval,inputHashes} from './spec.mjs';
import {generate} from './generate.mjs';
import {loadCatalog,select,summarize} from './catalog.mjs';

const before=inputHashes();
assert.equal(checkSpec().planned_new_rows,20000);
assert.throws(()=>requireApproval(),/Explicit D007 approval/);
assert.throws(()=>generate(undefined,'2026-10-17T00:00:00Z'),/Explicit D007 approval/);
const catalog=loadCatalog({includeNew:false});
assert.equal(catalog.length,2242);
assert.equal(new Set(catalog.map(x=>x.record.record_id)).size,2242);
assert.equal(select(catalog,{batch:'D005'}).length,534);
const d005=select(catalog,{batch:'D005'}).filter(x=>x.record.dataset_type!=='T01');
assert.equal(d005.length,528);assert.ok(d005.every(x=>x.schema_conforming));
assert.ok(select(catalog,{batch:'D005',asOf:'2026-10-16T00:00:00Z'}).every(x=>!x.lineage.some(l=>l.rule==='approved-synthetic-supplement')));
assert.equal(summarize(catalog,{type:'T24',field:'rating_value'}).status,'separated');
assert.throws(()=>select(catalog,{asOf:'invalid-date'}),/timestamp required/);
assert.equal(summarize(catalog,{type:'T24',field:'rating_value',asOf:'2020-01-01T00:00:00Z'}).groups.length,0);
assert.deepEqual(inputHashes(),before);
console.log(JSON.stringify({status:'pass',scope:'existing-only-preflight',checks:13,existing_rows:2242,new_rows_generated:0,planned_rows:20000,
 legacy_canonical_conforming:catalog.filter(x=>x.schema_conforming).length,
 limitations:'D007 generation, distributions, independent oracle and RDF tests have not run. Legacy gaps are exposed rather than filled.'}));
