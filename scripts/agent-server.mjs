import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadCurrentData} from './current-data.mjs';
import {CatalogTools} from '../backend/agent-tools.mjs';
import {AgentFlow,FlowStore} from '../backend/agent-flow.mjs';
import {localPlanner} from '../backend/local-planner.mjs';
import {createAgentServer} from '../backend/agent-http.mjs';
import {createLiveRuntime} from '../backend/agent-runtime.mjs';

const live=process.argv.includes('--live');
if(live){const envFile=fileURLToPath(new URL('../.env.local',import.meta.url));if(fs.existsSync(envFile))process.loadEnvFile(envFile);}
const runtime=live?createLiveRuntime({onDiagnostic:process.send?detail=>process.send({type:'model_diagnostic',detail}):undefined}):{model:localPlanner,info:{mode:'offline_model_substitute',externalModelEnabled:false}};

const work=new URL('../work/',import.meta.url);fs.mkdirSync(work,{recursive:true});
const port=Number(process.env.AGENT_PORT||8788);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid AGENT_PORT');
const {manifest,catalog}=loadCurrentData(process.env.MARKETING_DATA_DIR);
runtime.info={...runtime.info,dataHash:manifest.data_sha256,dataContract:manifest.contract};
const entries=catalog.records.map(record=>({batch:'CURRENT',country:record.dataset_type==='T01'?'GLOBAL':record.scope_id.split('-')[1],record,payload:record,schema_conforming:true}));
const flow=new AgentFlow({tools:new CatalogTools(entries,{manifest}),model:runtime.model,
  store:new FlowStore(process.env.AGENT_DB_PATH||fileURLToPath(new URL(live?'agent-flow-live.sqlite':'agent-flow.sqlite',work)))});
const origins=process.env.AGENT_UI_ORIGINS?.split(',');
const server=createAgentServer(flow,{...(origins?{origins}:{}),runtimeInfo:runtime.info});
server.on('error',error=>{console.error('Agent server failed: '+error.code);flow.close();process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Agent API http://127.0.0.1:${port} (${runtime.info.mode}; real Ads disabled)`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{flow.close();process.exit(0);}));
// Only a parent process with an IPC channel can request this graceful test restart.
if(process.send)process.on('message',message=>{if(message==='shutdown')server.close(()=>{flow.close();process.exit(0);});});
