import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {roasManifest,dataDirectory} from './data.mjs';
import {trainingIndex} from './training-data.mjs';
import {createRoasChat,roasProtocol} from '../../backend/roas/roas-agent.mjs';
import {createAgentServer} from '../../backend/roas/agent-http.mjs';
import {createLiveRuntime} from '../../backend/roas/agent-runtime.mjs';
const live=process.argv.includes('--live');
if(live){const f=fileURLToPath(new URL('../../.env.local',import.meta.url));if(fs.existsSync(f))process.loadEnvFile(f);}
const runtime=live?createLiveRuntime({protocol:roasProtocol}):{info:{mode:'offline_model_substitute',externalModelEnabled:false}};
const directory=process.env.ROAS_DATA_DIR||dataDirectory;
const manifest=roasManifest(directory);trainingIndex(directory);
const port=Number(process.env.AGENT_PORT||8788);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid AGENT_PORT');
const server=createAgentServer(null,{origins:process.env.AGENT_UI_ORIGINS?.split(','),runtimeInfo:{...runtime.info,dataHash:manifest.data_sha256,dataContract:manifest.contract},roasChat:createRoasChat({directory,model:live?runtime.model:undefined})});
server.on('error',e=>{console.error('ROAS server failed: '+e.code);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('ROAS API http://127.0.0.1:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
