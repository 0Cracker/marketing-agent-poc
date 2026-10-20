// Compile existing schemas only. No instances, generators or fixtures are imported.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../../..');
const store=path.join(root,'node_modules','.pnpm');
const dirs=fs.readdirSync(store);
const ajvDir=dirs.find(d=>/^ajv@8\./.test(d));
const formatsDir=dirs.find(d=>/^ajv-formats@/.test(d));
assert.ok(ajvDir&&formatsDir,'existing Ajv 8/ajv-formats required');
const require=createRequire(import.meta.url);
const Module=require('node:module');
process.env.NODE_PATH=dirs.filter(d=>/^(ajv@8\.|ajv-formats@|fast-deep-equal@|fast-uri@|json-schema-traverse@1\.|require-from-string@)/.test(d)).map(d=>path.join(store,d,'node_modules')).join(path.delimiter);
Module._initPaths(); // Same process only; no global environment or filesystem changes.
const Ajv=require(path.join(store,ajvDir,'node_modules/ajv/dist/2020.js')).default;
const formats=require(path.join(store,formatsDir,'node_modules/ajv-formats')).default;
const results=[];
for(const relative of ['../batches/D003B/batch.schema.json','../schemas/marketing-records.schema.json']){
 const schema=JSON.parse(fs.readFileSync(path.resolve(here,relative),'utf8'));
 const ajv=new Ajv({strict:false,allErrors:true});
 formats(ajv);
 assert.ok(ajv.validateSchema(schema),JSON.stringify(ajv.errors));
 ajv.compile(schema);
 if(relative.includes('marketing-records')){ajv.addSchema(schema,'catalog');ajv.compile({$ref:'catalog#/$defs/HistoricalReport'});}
 results.push({schema:relative,metaschema:'pass',compile:'pass',instance_validation:'not_run'});
}
console.log(JSON.stringify({node:process.version,ajv:require(path.join(store,ajvDir,'node_modules/ajv/package.json')).version,results}));
