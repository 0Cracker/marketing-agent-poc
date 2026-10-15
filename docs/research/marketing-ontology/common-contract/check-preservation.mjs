// Read-only byte/Git state verification; no JSONL records are parsed or reused.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../../..');
const baseline=JSON.parse(fs.readFileSync(path.join(here,'preservation-baseline.json'),'utf8'));
const digest=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const allowed=new Set(['docs/decisions/decision-001.md',...['README.md','ontology-spec.md','schema-contract.md','question-coverage.md','research-status.md','data-proposal.md','work-log.md'].map(f=>'docs/research/marketing-ontology/'+f)]);
const changed=[],unexpected=[];
let unchanged=0;
for(const [relative,hash] of Object.entries(baseline.files)){
 const key=relative.replaceAll('\\','/');
 const file=path.join(root,relative);
 if(!fs.existsSync(file)){unexpected.push({file:key,reason:'removed'});continue;}
 if(digest(file)===hash){unchanged++;continue;}
 changed.push(key);
 if(!allowed.has(key))unexpected.push({file:key,reason:'changed outside documentation scope'});
}
const head=git('rev-parse','HEAD').trim()===baseline.head;
const refs=git('show-ref')===baseline.refs;
const staged=git('diff','--cached')===baseline.staged;
const deletions=s=>s.split('\n').filter(l=>l.slice(0,2).includes('D')).sort();
const deleted=JSON.stringify(deletions(git('status','--porcelain=v1')))===JSON.stringify(deletions(baseline.status));
const manifest=JSON.parse(fs.readFileSync(path.join(here,'../batches/D003B/manifest.json'),'utf8'));
const sourceHashes=Object.entries(manifest.files).map(([name,spec])=>({file:name,unchanged:digest(path.join(here,'../batches/D003B/source',name))===spec.sha256}));
const result={baseline_files:Object.keys(baseline.files).length,unchanged_existing_files:unchanged,expected_document_changes:changed,unexpected,head_preserved:head,refs_preserved:refs,staged_diff_preserved:staged,existing_deletion_states_preserved:deleted,source_hashes:sourceHashes,status:!unexpected.length&&head&&refs&&staged&&deleted&&sourceHashes.every(x=>x.unchanged)?'pass':'fail',source_rows_parsed:0};
console.log(JSON.stringify(result,null,2));
if(result.status==='fail')process.exit(1);
