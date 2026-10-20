// Read-only verification of definitions. Does not create synthetic record fixtures.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {policies,horizon,detailWindow,historicalReportBudget} from './temporal-policy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const schema = JSON.parse(fs.readFileSync(path.join(here,'marketing-records.schema.json'),'utf8'));
const types = Object.keys(schema.$defs).filter(k=>/^T\d{2}$/.test(k));
assert.equal(types.length,40);
assert.equal(new Set(types.map(k=>schema.$defs[k]['x-group'])).size,18);
assert.equal(schema.oneOf.length,40);
assert.equal(policies.length,40);
assert.equal(new Set(policies.map(p=>p[0])).size,40);
assert.deepEqual([...types].sort(),policies.map(p=>p[0]).sort());
assert.equal(policies.reduce((n,p)=>n+p[4],historicalReportBudget),15419);
assert.ok(schema.$defs.Period.properties.grain.enum.includes('quarter'));
assert.ok(schema.$defs.Period.properties.grain.enum.includes('year'));
assert.equal(schema.$defs.HistoricalReport.properties.dataset_type.const,'H01');
assert.ok(schema.$defs.HistoricalReport.required.includes('temporal'));
assert.equal((Date.parse(detailWindow.end_exclusive)-Date.parse(detailWindow.start))/86400000,28);
assert.equal(new Date(detailWindow.start).getUTCDay(),1);
assert.equal(new Date(detailWindow.end_exclusive).getUTCDay(),1);
assert.ok(detailWindow.start>=horizon.start&&detailWindow.end_exclusive<=horizon.end_exclusive);
assert.equal((new Date(horizon.end_exclusive).getUTCFullYear()-new Date(horizon.start).getUTCFullYear())*12+new Date(horizon.end_exclusive).getUTCMonth()-new Date(horizon.start).getUTCMonth(),24);
const sources = fs.readFileSync(path.join(here,'..','data-source-register.md'),'utf8');
const sourceIds = new Set([...sources.matchAll(/^\| (M\d{2}) /gm)].map(m=>m[1]));
const failures = [];
let fieldCount=0;
for(const id of types){
  const d=schema.$defs[id];
  assert.equal(d.properties.dataset_type.const,id);
  assert.equal(d.additionalProperties,false);
  assert.ok(d.required.includes('temporal'));
  assert.equal(d.properties.temporal.$ref,'#/$defs/TemporalContext');
  assert.equal(d['x-temporal-policy'].record_budget,policies.find(p=>p[0]===id)[4]);
  for(const k of d.required)assert.ok(d.properties[k],`${id} unknown required ${k}`);
  for(const s of d['x-source-refs'])if(s.startsWith('M')&&!sourceIds.has(s))failures.push(`${id}: missing source ${s}`);
  fieldCount+=Object.keys(d.properties).length;
}
function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.$ref)assert.ok(schema.$defs[node.$ref.split('/').at(-1)],`unresolved ${node.$ref}`);
  if(node.examples||node.default)failures.push('record examples/defaults are forbidden before approval');
  for(const v of Object.values(node))if(typeof v==='object')visit(v);
}
visit(schema);
assert.deepEqual(failures,[]);

// Reuse validation packages already present in the project's pnpm store; add no dependency.
const store=path.join(root,'node_modules','.pnpm');
const dirs=fs.existsSync(store)?fs.readdirSync(store):[];
const ajvDir=dirs.find(d=>/^ajv@8\./.test(d));
const formatsDir=dirs.find(d=>/^ajv-formats@/.test(d));
let metaschemaValidation='not run: existing Ajv 8/ajv-formats unavailable';
if(ajvDir&&formatsDir){
  try {
  const require=createRequire(import.meta.url);
  const Ajv=require(path.join(store,ajvDir,'node_modules','ajv','dist','2020.js')).default;
  const formats=require(path.join(store,formatsDir,'node_modules','ajv-formats')).default;
  const ajv=new Ajv({strict:false,allErrors:true});
  formats(ajv);
  assert.ok(ajv.validateSchema(schema),JSON.stringify(ajv.errors));
  ajv.compile(schema);
  ajv.addSchema(schema,'marketing-catalog');
  ajv.compile({$ref:'marketing-catalog#/$defs/HistoricalReport'});
  metaschemaValidation='passed: Draft 2020-12 metaschema, 40 types and H01 compile with formats';
  } catch(error) {
    if(error.code !== 'MODULE_NOT_FOUND')throw error;
    if(!process.env.MARKETING_SCHEMA_PATH_RETRY){
      const packagePaths=dirs.filter(d=>/^(ajv@8\.|fast-deep-equal@|fast-uri@|json-schema-traverse@1\.|require-from-string@)/.test(d)).map(d=>path.join(store,d,'node_modules'));
      const retry=spawnSync(process.execPath,[fileURLToPath(import.meta.url)],{encoding:'utf8',env:{...process.env,MARKETING_SCHEMA_PATH_RETRY:'1',NODE_PATH:[...packagePaths,process.env.NODE_PATH].filter(Boolean).join(path.delimiter)}});
      if(retry.error)throw retry.error;
      process.stdout.write(retry.stdout);
      process.stderr.write(retry.stderr);
      process.exit(retry.status??1);
    }
    metaschemaValidation=`not run: existing package dependency unavailable (${error.message.split('\n')[0]})`;
  }
}
console.log(JSON.stringify({types:types.length,propertyOccurrences:fieldCount,registeredSources:sourceIds.size,temporalPolicy:'passed: 40 types, 24 months, 28 days/4 complete weeks, H01 separate',proposedRecordBudget:15419,metaschemaValidation,generatedMarketingRecords:0}));
