// Bridges C's asynchronous run journal to D's transactional SQLite store.
export function createRunPersistence(store) {
  return {
    async createRun() { /* D atomically reserves the run before HTTP 202. */ },
    async appendEvent(runId,event) {
      store.recordEvent({runId,event});
      if(event.kind==='stage')store.saveRun({runId,executionStatus:'running',stage:event.stage,
        ...(event.stage==='routed'&&['quick','deep'].includes(event.argsSummary)?{route:event.argsSummary}:{})});
    },
    async updateRun(state) {
      const status=state.executionStatus||state.runStatus;
      const verified=['completed','partial'].includes(status)&&state.result?.status===status;
      store.saveRun({
        runId:state.runId,executionStatus:status,stage:state.stage,
        route:state.route,causeStatus:state.causeStatus,stopReason:state.stopReason,
        sourceHashes:{roas:state.appliedScope.dataHash},
        result:verified?{...state.result,verified:true}:undefined,
        usage:state.usage
      });
    },
    claimModelAttempt: input=>store.claimModelAttempt(input),
    publishEvidence: input=>store.publishEvidence(input)
  };
}

export function createHttpRunEngine(engine) {
  return {
    start: input=>engine.start({...input,
      history:(input.history||[]).slice(-8).map(item=>({role:item.role,text:item.content??item.text}))}),
    cancel: input=>engine.cancel(input)
  };
}
