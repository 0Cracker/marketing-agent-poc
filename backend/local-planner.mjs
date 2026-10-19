// A clearly labeled offline model substitute for procedure demonstrations.
// It chooses tools, then uses their actual returned IDs; it contains no answers,
// marketing values, test IDs or execution privileges.
export function localPlanner({role,focus,history}){
  if(role==='analysis'){
    if(!history.length)return {tool:'market_compare',args:{}};
    if(history.length===1)return {tool:'relations',args:{candidate:focus||'price'}};
    const relations=history.find(x=>x.tool==='relations').result;
    // The flow accepts at most 100 selected facts, including multi-month scopes.
    return {finish:{facts:history.flatMap(x=>x.result.facts||[]).slice(0,100).map(f=>f.id),
      hypotheses:[{candidate:relations.candidate,supports:relations.supportIds,counters:relations.counterIds,causal:false}],recommendation:'investigate'}};
  }
  if(!history.length)return {tool:'budget_inputs',args:{}};
  if(history.length===1){
    const {scenarios,models,policies}=history[0].result;
    return {tool:'simulate',args:{baselineId:scenarios[0].record_id,candidateId:scenarios[1].record_id,modelId:models[0].record_id,policyId:policies[0].record_id}};
  }
  return {finish:{simulationId:history.find(x=>x.tool==='simulate').result.id,action:'reallocate'}};
}
