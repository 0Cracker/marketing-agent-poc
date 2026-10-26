import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {generateDiverseCases} from './augment-roas-diversity.mjs';
import {loadCurrentData,dataDirectory,sha256} from './current-data.mjs';
import {registerDefinitions} from './augment-roas-case.mjs';
import {businessKey} from './data-business-keys.mjs';
import {validRecord} from '../docs/research/marketing-ontology/batches/D007/catalog.mjs';
import {analyzeRoasCase} from '../backend/roas-case.mjs';

const evidence=path.resolve(import.meta.dirname,'../evidence/roas-diversity-20261022');
const read=file=>JSON.parse(fs.readFileSync(path.join(evidence,file),'utf8'));
const json=value=>JSON.stringify(value,null,2)+'\n';
const jsonl=rows=>Buffer.from(rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
const append=(old,added)=>Buffer.concat([old,...(old.length&&old.at(-1)!==10?[Buffer.from('\n')]:[]),added]);

export function installRoasDiversity(){
 const approval=read('approval.json'),baseline=read('baseline.json');
 assert.equal(approval.approved,true,'Explicit generation approval missing');
 const generated=generateDiverseCases(),{records,profiles,counts,spec}=generated;
 assert(records.length>0&&records.length<=approval.maximumObservationRows,'Approved row limit');
 assert.deepEqual(profiles.map(row=>row.scenario_id).toSorted(),approval.cases.toSorted());
 const ids=new Set(approval.cases),loaded=loadCurrentData(),{catalog,manifest}=loaded;
 const installed=catalog.records.filter(row=>ids.has(row.scenario_id));
 if(installed.length){
  assert.deepEqual(installed.toSorted((a,b)=>a.record_id.localeCompare(b.record_id)),records.toSorted((a,b)=>a.record_id.localeCompare(b.record_id)),'Installed cases differ');
  for(const profile of profiles)assert.deepEqual(catalog.definitions.scenario_profiles.find(row=>row.scenario_id===profile.scenario_id),profile);
  return {unchanged:true,newRows:0,scenarioRows:installed.length,dataHash:manifest.data_sha256};
 }
 assert.equal(manifest.data_sha256,approval.baselineDataHash,'Approved baseline changed');
 for(const [file,entry] of Object.entries(baseline.files))assert.equal(sha256(fs.readFileSync(path.join(dataDirectory,file))),entry.sha256,file+' changed');
 assert.equal(new Set([...catalog.records,...records].map(row=>row.record_id)).size,catalog.records.length+records.length,'Duplicate ID');
 assert.equal(new Set([...catalog.records,...records].map(businessKey)).size,catalog.records.length+records.length,'Duplicate business key');
 const allIds=new Set([...catalog.records,...records].map(row=>row.record_id));
 for(const row of records){assert(validRecord(row).conforming,row.record_id+' violates existing schema');for(const ref of row.related_record_ids||[])assert(allIds.has(ref),'Missing reference');}
 for(const profile of profiles){const report=analyzeRoasCase([...catalog.records,...records],profile,{asOf:profile.default_as_of});assert.equal(report.status,'review_ready',JSON.stringify(report.gaps));}

 const lock={spec,counts,rows:records.length,profiles,specSha256:sha256(JSON.stringify(spec)),generatorSha256:sha256(fs.readFileSync(new URL('./augment-roas-diversity.mjs',import.meta.url)))};
 const lockPath=path.join(evidence,'execution-spec.json');
 if(fs.existsSync(lockPath))assert.deepEqual(JSON.parse(fs.readFileSync(lockPath)),lock);
 else fs.writeFileSync(lockPath,json(lock),{flag:'wx'});
 const inventory=structuredClone(baseline.sourceInventory),provenance=[],migration=[],snapshots=[],writes=new Map();
 const stage=(file,bytes)=>writes.set(path.join(dataDirectory,file),Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes));
 for(const file of manifest.files){
  const added=records.filter(row=>row.dataset_type===file.type);if(!added.length)continue;
  const bytes=jsonl(added),hash=sha256(bytes),archive='archive/files/'+hash+'.jsonl',archivePath=path.join(dataDirectory,archive);
  if(fs.existsSync(archivePath))assert.equal(sha256(fs.readFileSync(archivePath)),hash);
  else fs.writeFileSync(archivePath,bytes,{flag:'wx'});
  const sourcePath='data/'+archive;
  inventory.push({repository:'marketing-agent-poc',path:sourcePath,sha256:hash,bytes:bytes.length,rows:added.length,kind:'original',archive});
  snapshots.push({type:file.type,path:sourcePath,sha256:hash,rows:added.length});
  added.forEach((row,index)=>{
   const entry={source_key:row.scenario_id+'/'+row.record_id,record_id:row.record_id,type:row.dataset_type,decision:'active',reason:'Explicitly approved independent diversity scenario; excluded from default comparison scope',active_id:row.record_id,replacement_id:null,source_path:sourcePath,line:index+1,source_sha256:hash,record_sha256:sha256(JSON.stringify(row)),business_key_sha256:sha256(businessKey(row))};
   migration.push(entry);provenance.push({...entry,file:file.file,archive,source_record_sha256:entry.record_sha256,transformation:'Approved synthetic observation, unchanged from immutable diversity snapshot'});
  });
  const combined=append(fs.readFileSync(path.join(dataDirectory,file.file)),bytes);stage(file.file,combined);file.rows+=added.length;file.bytes=combined.length;file.sha256=sha256(combined);
 }
 registerDefinitions(catalog.definitions,records,true);
 catalog.definitions.scenario_profiles=[...(catalog.definitions.scenario_profiles||[]),...profiles];
 const definitions=json(catalog.definitions);stage('definitions.json',definitions);
 manifest.metadata.find(row=>row.file==='definitions.json').sha256=sha256(definitions);
 stage('archive/source-inventory.json',json(inventory));
 stage('provenance.jsonl',append(fs.readFileSync(path.join(dataDirectory,'provenance.jsonl')),jsonl(provenance)));
 stage('migration-map.jsonl',append(fs.readFileSync(path.join(dataDirectory,'migration-map.jsonl')),jsonl(migration)));
 manifest.rows+=records.length;manifest.preserved_rows+=records.length;manifest.source_files+=snapshots.length;manifest.decisions.active+=records.length;
 manifest.policy+=' R002, R003 and R004 are explicitly approved independent diversity cases selected by scenario profile; default scopes and R001 remain unchanged.';
 manifest.data_sha256=sha256(JSON.stringify({contract:manifest.contract,screen_contract:manifest.screen_contract,schema_sha256:manifest.schema_sha256,source_created_at:manifest.source_created_at,scope_ids:manifest.scope_ids,period:manifest.period,files:manifest.files.map(({file,sha256})=>({file,sha256})),metadata:manifest.metadata}));
 // Publish the manifest last; roll back only files this process has actually replaced.
 stage('manifest.json',json(manifest));
 const replaced=[];
 try{
  for(const [target,bytes] of writes){const original=fs.readFileSync(target);fs.writeFileSync(target,bytes);replaced.push({target,original,bytes});}
  const after=loadCurrentData();assert.deepEqual(after.catalog.records.filter(row=>!ids.has(row.scenario_id)),loaded.catalog.records,'Original observations changed');
 }catch(error){for(const {target,original,bytes} of replaced.reverse())if(sha256(fs.readFileSync(target))===sha256(bytes))fs.writeFileSync(target,original);throw error;}
 const result={approved:true,newRows:records.length,counts,baselineRows:baseline.rows,baselineDataHash:baseline.dataHash,dataHash:manifest.data_sha256,specSha256:lock.specSha256,snapshots,diagnostics:generated.diagnostics,externalModelCalls:0,realAdsCalls:0};
 fs.writeFileSync(path.join(evidence,'generation.json'),json(result),{flag:'wx'});
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert(process.argv.includes('--write'),'Use --write only with recorded approval');console.log(JSON.stringify(installRoasDiversity(),null,2));}
