import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const option=process.argv.indexOf('--output');
if(option===-1||!process.argv[option+1])throw Error('--output NEW_REPORT.json required');
const output=path.resolve(process.argv[option+1]);if(fs.existsSync(output))throw Error('Report already exists; choose a new path');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function list(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const base=path.join(root,'docs/research/marketing-ontology');
const watched=[...list(path.join(base,'batches')).filter(f=>f.includes(path.sep+'source'+path.sep)||path.basename(f)==='manifest.json'),
  ...list(path.join(base,'schemas')),path.join(base,'common-contract/ontology.ttl'),path.join(base,'common-contract/shapes.ttl')];
const before=Object.fromEntries(watched.map(f=>[path.relative(root,f).replaceAll('\\','/'),sha(f)]));
const git=()=>spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
const startedAt=new Date().toISOString(),head=git();
const testFiles=fs.readdirSync(path.join(root,'tests/agents')).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>'tests/agents/'+f);
const commands=[['agents',['--test','--test-concurrency=1','--test-reporter=tap',...testFiles]],
  ['existing-marketing',['--experimental-strip-types','tests/marketing.test.ts']],['existing-demo',['--experimental-strip-types','tests/demo.test.ts']],
  ['existing-catalog',['docs/research/marketing-ontology/batches/D007/query-check.mjs']]];
const checks=[];
for(const [name,args] of commands){
  const p=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
  const log=output.replace(/\.json$/,'.'+name+'.txt');fs.writeFileSync(log,(p.stdout||'')+(p.stderr||''),{flag:'wx'});
  const counts=name==='agents'?Object.fromEntries(['tests','pass','fail','skipped','cancelled'].map(k=>[k,Number(p.stdout?.match(new RegExp('^# '+k+' (\\d+)$','m'))?.[1]??-1)])):null;
  const pass=p.status===0&&!p.error&&(counts===null||counts.tests>0&&counts.pass===counts.tests&&counts.fail===0&&counts.skipped===0&&counts.cancelled===0);
  checks.push({name,status:pass?'pass':'fail',command:[process.execPath,...args],exitCode:p.status,counts,log:path.relative(root,log).replaceAll('\\','/'),error:p.error?.message||null});
}
const changed=watched.filter(f=>sha(f)!==before[path.relative(root,f).replaceAll('\\','/')]);
const result={status:checks.every(c=>c.status==='pass')&&!changed.length&&git()===head?'pass':'fail',startedAt,finishedAt:new Date().toISOString(),
  head,node:process.version,testFiles,checks,preservedSourceAndContractFiles:watched.length,changedInputs:changed,inputHashes:before,
  newSourceRows:0,externalModelCalls:0,realAdsCalls:0,limitations:['Offline model substitute and stubbed HTTP responses; live model quality not evaluated','Synthetic execution only; no UI or actual Ads integration','Typed relation projections use existing ontology predicates; no new RDF reasoner']};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:result.status,tests:checks[0].counts,regression:checks.map(c=>({name:c.name,status:c.status})),preservedFiles:watched.length,changedInputs:changed.length,report:output}));
process.exitCode=result.status==='pass'?0:1;
