import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const dataDirectory=path.resolve(import.meta.dirname,'../../data/roas');
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const names=['training-dashboard.json','roas-reviews.json','roas-review-classification.json','roas-product-metadata.json','source-ads.jsonl'];
export function roasManifest(directory=dataDirectory){
 const m=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
 assert.equal(m.contract,'roas-data/1');assert.deepEqual(m.files.map(f=>f.file),names);
 assert(m.files.every(f=>Number.isSafeInteger(f.bytes)&&f.bytes>0&&/^[a-f0-9]{64}$/.test(f.sha256)),'roas_manifest_entry_invalid');
 assert.equal(m.data_sha256,sha256(JSON.stringify({contract:m.contract,files:m.files})));
 return m;
}
// Verify the requested source only: optional review failures must not block performance.
export function readDataFile(file,directory=dataDirectory){
 const entry=roasManifest(directory).files.find(f=>f.file===file);assert(entry,'roas_source_not_registered');
 const bytes=fs.readFileSync(path.join(directory,file));assert.equal(bytes.length,entry.bytes,file+' size');assert.equal(sha256(bytes),entry.sha256,file+' hash');return bytes;
}
export function sourceCatalog(directory=dataDirectory){return {records:readDataFile('source-ads.jsonl',directory).toString('utf8').trim().split(/\r?\n/).map(JSON.parse)};}
