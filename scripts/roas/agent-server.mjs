import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import {roasManifest,dataDirectory} from './data.mjs';
import {trainingIndex} from './training-data.mjs';
import {createRoasChat} from '../../backend/roas/roas-agent.mjs';
import {createAgentServer} from '../../backend/roas/agent-http.mjs';
import {createProviderPool} from '../../backend/roas/providers/index.mjs';
import {createMockProviderPool} from '../../backend/roas/mock-provider.mjs';
import {createToolRuntime} from '../../backend/roas/tools/index.mjs';
import {createRunEngine} from '../../backend/roas/engine/index.mjs';
import {createRunStore,createRunRoutes,createGatewayAuth,RunApiError} from '../../backend/roas/run-api/index.mjs';
import {createRunPersistence,createHttpRunEngine} from '../../backend/roas/run-integration.mjs';
import {createTraceServer} from '../../backend/roas/run-api/trace-server.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
// Environment variables already set by the process take precedence over local files.
// Only missing values are read; never print API keys or environment contents.
for(const name of ['.env.local','.env']) {
  const filename=path.join(root,name);
  if(fs.existsSync(filename)) {
    for(const [key,value] of Object.entries(parseEnv(fs.readFileSync(filename,'utf8'))))
      if(!process.env[key])process.env[key]=value;
  }
}
const directory=process.env.ROAS_DATA_DIR||dataDirectory;
const manifest=roasManifest(directory);trainingIndex(directory);
const port=Number(process.env.AGENT_PORT||8788);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid AGENT_PORT');
const tracePort=Number(process.env.AGENT_TRACE_PORT||(port===8789?8790:8789));
if(!Number.isInteger(tracePort)||tracePort<1024||tracePort>65535||tracePort===port)throw Error('Invalid AGENT_TRACE_PORT');
const origins=(process.env.AGENT_UI_ORIGINS||'http://127.0.0.1:5173,http://localhost:5173')
  .split(',').map(item=>item.trim()).filter(Boolean);
const dbPath=process.env.AGENT_DB_PATH||path.join(root,'.agent-state','roas-runs.sqlite');
fs.mkdirSync(path.dirname(dbPath),{recursive:true});
const store=createRunStore({dbPath});
const mock=process.argv.includes("--mock");
const pool=mock?createMockProviderPool():createProviderPool({env:process.env});
const statuses=pool.providerStatus({role:'quick_answer'})
  .map(({id,provider,configured,eligible,reason})=>({id,provider,configured,eligible,reason}));
const eligible=!mock&&statuses.some(item=>item.eligible)&&
  pool.providerStatus({role:'first_tool_classifier'}).some(item=>item.provider==='jev'&&item.eligible);
const engine=createRunEngine({workflow:'jev',providerPool:pool,store:createRunPersistence(store),
  toolRuntimeFactory:options=>createToolRuntime({...options,directory})});
const runEngine=createHttpRunEngine(engine);
const server=createAgentServer(null,{
  origins,
  runtimeInfo:{mode:eligible?'remote_model':'offline_model_substitute',
    externalModelEnabled:eligible,dataHash:manifest.data_sha256,dataContract:manifest.contract},
  // Keep the legacy endpoint's historical response contract; the new run API
  // must not fabricate an AI completion when models are unavailable.
  roasChat:createRoasChat({directory}),
  runRoutes:({token})=>{
    const gatewaySecret=process.env.AGENT_QA_GATEWAY_SECRET;
    const authContext=gatewaySecret
      ? createGatewayAuth({secret:gatewaySecret,allowedOrigins:origins})
      : {allowedOrigins:new Set(origins),
        verify({req}) {
          // Local development only. NOT public QA authentication.
          if((req.method==='POST'&&!req.headers.origin)||
              (req.headers.origin&&!origins.includes(req.headers.origin))||
              req.headers['x-agent-token']!==token)
            throw new RunApiError('authentication_required');
          return {accountId:'qa-local',browserId:'operator-local-browser'};
        }};
    return createRunRoutes({engine:runEngine,store,authContext});
  }
});
server.on('error',error=>{console.error('ROAS server failed: '+error.code);process.exitCode=1;store.close();});
const traceServer=createTraceServer(store);
traceServer.on('error',error=>console.error('Agent Trace failed: '+error.code));
server.listen(port,'127.0.0.1',()=>{
  // Keep Trace off the Agent API listener that an external QA gateway can forward.
  traceServer.listen(tracePort,'127.0.0.1',()=>console.info('Agent Trace: http://127.0.0.1:'+tracePort+'/agent-trace'));
  console.info('ROAS API on loopback port '+port);
  console.info('Agent provider readiness (no external balance verification): '+JSON.stringify(statuses));
  if(mock)console.info('Local MOCK only: no external model API requests');
});
let closing=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
  if(closing)return;closing=true;
  traceServer.close();
  server.close(()=>{store.close();process.exit(0);});
});
