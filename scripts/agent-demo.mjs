import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {loadCatalog} from '../docs/research/marketing-ontology/batches/D007/catalog.mjs';
import {CatalogTools} from '../backend/agent-tools.mjs';
import {AgentFlow,FlowStore} from '../backend/agent-flow.mjs';
import {localPlanner} from '../backend/local-planner.mjs';

export async function demo(){
  const catalog=loadCatalog(),tools=new CatalogTools(catalog),flow=new AgentFlow({tools,model:localPlanner,store:new FlowStore()});
  try{
    const market=catalog.find(x=>x.batch==='D007'&&x.country==='KR'&&x.record.dataset_type==='T03'&&x.record.period.start==='2026-08-01').record;
    const scope={batch:'D007',country:'KR',scopeId:market.scope_id,productIds:['P1A','P2A'],start:market.period.start,end:market.period.end_exclusive,asOf:new Date().toISOString()};
    const analysis=await flow.analyze({question:'선택 시장의 경쟁 열위와 가격 관련 근거 확인',scope});
    const proposal=analysis.status==='analyzed'?await flow.budget({analysisId:analysis.id,analysisVersion:analysis.version,userSelected:true}):null;
    const followup=await flow.analyze({parentId:analysis.id,question:'그중 가격 영향만 다시 봐줘',focus:'price'});
    return {mode:'offline_model_substitute',marketingSource:'approved_D007_read_only',newSourceRows:0,externalModelCalls:0,realAdsCalls:0,
      analysis:{id:analysis.id,status:analysis.status,scope:analysis.scope,output:analysis.output,events:analysis.events},
      proposal:proposal&&{id:proposal.id,statusAtCreation:proposal.status,simulation:proposal.simulation,statusAfterFollowup:flow.get(proposal.id).status},
      followup:{id:followup.id,parentId:followup.parentId,status:followup.status,output:followup.output,events:followup.events}};
  }finally{flow.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=await demo(),index=process.argv.indexOf('--output');
  if(index!==-1)fs.writeFileSync(process.argv[index+1],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(result,null,2));
}
