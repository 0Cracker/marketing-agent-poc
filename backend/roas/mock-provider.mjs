// Explicit local development simulator. Never performs network or paid model calls.
const mockCandidate=Object.freeze({id:'local-mock',provider:'mock',model:'local-data-only',
  transport:'in_process',billingBucket:'none',eligible:true});

export function createMockProviderPool() {
  return {
    providerStatus:()=>[{...mockCandidate,configured:true,reason:'mock_only'}],
    eligibleCandidates:()=>[mockCandidate],
    async invokeOnce({instruction,input,format}) {
      if(format==='jev') {
        const question=input.state.user_question;
        const grouped=/캠페인별|기기별|타깃별/u.test(question);
        const dimension=question.includes('기기별')?'device':question.includes('타깃별')?'audienceId':'campaign';
        const route=/분석|원인|왜/u.test(question)?'deep':'quick';
        const yes=new Set(['need_overview',...(grouped?['need_metric_detail','detail_roas_'+dimension]:[])]);
        return {output:{answers:Object.fromEntries(Object.entries(input.questions).map(([id,q])=>[id,q.type==='choice'
          ?{type:'choice',choice:route,probabilities:{quick:route==='quick'?1:0,deep:route==='deep'?1:0},confidence:1}
          :{type:'noul',noul:yes.has(id)?1:0}]))}};
      }
      if(instruction.includes('Choose the FIRST additional data tools'))
        return {output:{toolCalls:[]},actualModel:mockCandidate.model};
      if(instruction.includes('You decide follow-up tools'))
        return {output:{decision:'gemini_sufficient'},actualModel:mockCandidate.model};
      const overview=input.results.find(item=>item.name==='overview');
      const period=overview?.result?.periods?.find(item=>item.id==='current');
      if(!period?.evidenceId||!Number.isFinite(period.totals?.roas))
        throw Object.assign(Error('mock_source_unavailable'),{code:'model_protocol'});
      const value=period.totals.roas*100,id=period.evidenceId;
      if(format==='markdown') {
        const groups=input.results.find(item=>item.name==='metric_detail')?.result.groups||[];
        const rows=groups.filter(group=>Number.isFinite(group.current?.value)).map(group=>
          '| '+group.label.replaceAll('|','\\|')+' | '+(group.current.value*100).toFixed(1)+'% ['+group.current.evidenceId+'] |');
        return {output:'현재 ROAS는 **'+value.toFixed(1)+'%**입니다. ['+id+']'+
          (rows.length?'\n\n| 분석 단위 | 현재 ROAS |\n| --- | --- |\n'+rows.join('\n'):'')};
      }
      throw Object.assign(Error('unsupported_mock_format'),{code:'model_protocol'});
    }
  };
}
