import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const children=[
  spawn(process.execPath,['scripts/roas/agent-server.mjs',...(process.argv.includes('--mock')?['--mock']:[])],{cwd:root,stdio:'inherit'}),
  spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{cwd:root,stdio:'inherit'})
];
let closing=false;
function stop(code=0) {
  if(closing)return;
  closing=true;
  for(const child of children) {
    if(child.pid && child.exitCode===null) {
      if(process.platform==='win32')
        spawn('taskkill',['/pid',String(child.pid),'/t','/f'],{stdio:'ignore'});
      else child.kill('SIGTERM');
    }
  }
  process.exitCode=code;
}
for(const child of children) {
  child.on('error',error=>{console.error('Development process failed: '+error.code);stop(1);});
  child.on('exit',code=>stop(code||0));
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop(0));
