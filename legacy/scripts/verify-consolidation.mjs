import fs from 'node:fs';
import {spawn} from 'node:child_process';
const directory='docs/design/data-consolidation-20261019';fs.mkdirSync(directory,{recursive:true});
const commands=[
 ['consolidation',['scripts/check-data-consolidation.mjs']],
 ['redesign',['scripts/check-marketing-redesign.mjs']],
 ['screen-contract',['scripts/check-screen-contract.mjs']],
 ['standard-query',['scripts/check-standard-query.mjs']],
 ['all-connected',['scripts/check-all-connected.mjs']],
 ['client',['--experimental-strip-types','tests/agent-client.test.ts']],
 ['answer',['--experimental-strip-types','tests/agent-answer.test.ts']],
 ['presentation',['--experimental-strip-types','tests/agent-presentation.test.ts']],
 ['types',['node_modules/typescript/bin/tsc','--noEmit']],
 ['lint',['node_modules/eslint/bin/eslint.js','frontend/workbench']],
 ['build',['node_modules/vite/bin/vite.js','build']],
];
const checks=[];let cursor=0;
async function worker(){while(cursor<commands.length){const [name,args]=commands[cursor++],start=Date.now();const result=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:process.cwd(),windowsHide:true});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',e=>resolve({exitCode:-1,output:output+e.message}));child.on('close',exitCode=>resolve({exitCode,output}));});fs.writeFileSync(`${directory}/${name}.txt`,result.output);const check={name,args,exitCode:result.exitCode,ms:Date.now()-start,log:name+'.txt'};checks.push(check);console.log(JSON.stringify(check));}}
await Promise.all([worker(),worker(),worker()]);
const report={pass:checks.every(c=>c.exitCode===0),date:new Date().toISOString(),node:process.version,target:'existing uncommitted tree plus data consolidation; no Git state changes',checks};fs.writeFileSync(`${directory}/verification.json`,JSON.stringify(report,null,2)+'\n');process.exitCode=report.pass?0:1;
