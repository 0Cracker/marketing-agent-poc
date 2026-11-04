import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {businessKey} from './data-business-keys.mjs';
const root=path.resolve(import.meta.dirname,'..');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const rows=p=>fs.readFileSync(path.join(root,p),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const oi=process.argv.indexOf('--output');assert(oi>=0&&process.argv[oi+1],'--output NEW_JSON_FILE required');
const output=path.resolve(process.argv[oi+1]);assert(!fs.existsSync(output),'Do not overwrite previous evidence');
const beforeManifest=json('data/manifest.json');
const inventory=json('data/archive/source-inventory.json');
const sourceHashes=Object.fromEntries(inventory.map(i=>[path.resolve(root,i.repository==='marketing-agent-poc'?'../marketing-agent-poc':'.',i.path),i.sha256]));
const archiveHashes=Object.fromEntries(inventory.map(i=>[path.join(root,'data',i.archive),i.sha256]));
function unchanged(){for(const [p,h] of Object.entries({...sourceHashes,...archiveHashes}))assert.equal(hash(p),h,p);}
unchanged();
const source=rows('frontend/public/workbench-data/D008/source/T37.jsonl');
const groups=new Map();for(const r of source.filter(r=>r.record_kind==='performance')){const k=businessKey(r);groups.set(k,[...(groups.get(k)||[]),r]);}
assert.equal(groups.size,12);assert.equal(source.filter(r=>r.record_kind==='performance').length,85);
const selected=[...groups.values()].map(g=>g.map(r=>r.record_id).sort()[0]).sort();
const snapshots=[];
for(let iteration=0;iteration<2;iteration++){
 const run=spawnSync(process.execPath,['scripts/consolidate-data.mjs'],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const current=rows('data/site-events.jsonl'),migration=rows('data/migration-map.jsonl'),pending=json('data/archive/pending.json');
 assert.equal(current.length,35);assert.equal(current.filter(r=>r.record_kind==='incident').length,23);
 assert.deepEqual(current.filter(r=>r.record_kind==='performance').map(r=>r.record_id).sort(),selected);
 for(const r of current)assert.deepEqual(r,source.find(s=>s.record_id===r.record_id),'Source fields changed');
 assert.deepEqual(current.filter(r=>r.record_kind==='incident'),source.filter(r=>r.record_kind==='incident'));
 const excluded=migration.filter(m=>m.type==='T37'&&m.decision==='selection_excluded');assert.equal(excluded.length,73);
 for(const m of excluded){assert.equal(m.active_id,null);assert(selected.includes(m.replacement_id));const original=source.find(r=>r.record_id===m.record_id),representative=source.find(r=>r.record_id===m.replacement_id);assert.equal(businessKey(original),businessKey(representative));}
 assert(!pending.some(m=>m.type==='T37'));unchanged();
 const manifest=json('data/manifest.json');assert.equal(manifest.rows,30327);assert.equal(manifest.preserved_rows,52636);assert.equal(manifest.decisions.selection_excluded,73);assert.equal(manifest.pending_by_type.T37,undefined);
 const fileHashes=Object.fromEntries([...manifest.files.map(f=>f.file),'manifest.json','migration-map.jsonl','provenance.jsonl','archive/pending.json','archive/source-inventory.json'].map(f=>[f,hash(path.join(root,'data',f))]));
 snapshots.push({manifestHash:manifest.data_sha256,fileHashes,stdout:run.stdout.trim()});
}
assert.deepEqual(snapshots[0],snapshots[1],'Consolidation must be deterministic');
const report={pass:true,date:new Date().toISOString(),sourceRows:108,sourcePerformanceRows:85,groups:12,activePerformanceRows:12,activeIncidentRows:23,selectionExcludedRows:73,pendingPerformanceRows:0,sourceAndArchiveUnchanged:true,repeatRuns:2,deterministic:true,beforeDataHash:beforeManifest.data_sha256,dataHash:snapshots[1].manifestHash,selected,groupsDetail:[...groups.values()].map(g=>({businessKey:JSON.parse(businessKey(g[0])),selected:g.map(r=>r.record_id).sort()[0],sourceIds:g.map(r=>r.record_id).sort()})),snapshots};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,groupsDetail:undefined,snapshots:undefined}));
