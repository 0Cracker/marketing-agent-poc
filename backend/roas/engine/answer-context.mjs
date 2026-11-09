const traceFields=new Set(['evidenceId','evidenceIds','sourceRecordIds','sourceVersion',
  'sourceHash','dataHash','scopeFingerprint']);
const pageRows={metric_detail:'groups',metric_breakdown:'groups',trend:'days',records:'records',review_records:'reviews'};

function withoutTrace(value) {
  if(Array.isArray(value))return value.map(withoutTrace);
  if(value===null||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key])=>!traceFields.has(key))
    .map(([key,entry])=>[key,key==='values'||key==='rawRecord'?entry:withoutTrace(entry)]));
}

function answerResults(results) {
  const grouped=new Map();
  for(const {name,args={},result} of results) {
    const {offset=0,...conditions}=args;
    delete conditions.limit;
    conditions.scopeRole||='primary';
    const key=JSON.stringify([name,Object.entries(conditions).sort(([a],[b])=>a.localeCompare(b))]);
    if(!grouped.has(key))grouped.set(key,{name,conditions,pages:[]});
    grouped.get(key).pages.push({offset,result});
  }
  return [...grouped.values()].map(({name,conditions,pages})=>{
    const source=(pages.find(page=>page.result.status==='ready')||pages[0]).result;
    const data={...source};
    for(const key of ['scope','reportingBasis','nextOffset','truncated','limitations'])delete data[key];
    const field=pageRows[name];
    if(field&&Array.isArray(data[field])) {
      const rows=new Map();
      // Positions are stable across pages of the same query in a locked snapshot.
      for(const {offset,result} of pages) {
        for(const [index,row] of (result[field]||[]).entries())rows.set(offset+index,row);
      }
      data[field]=[...rows].sort(([a],[b])=>a-b).map(([,row])=>row);
      if(name==='trend'&&conditions.metrics?.length===1&&conditions.metrics[0]==='roas') {
        // The requested ROAS value and its numerator and denominator are in components.roas.
        data.days=data.days.map(day=>{
          const result={...day};
          delete result.totals;
          return result;
        });
      }
      const moreAvailable=Number.isFinite(data.total)?rows.size<data.total:source.nextOffset!=null;
      if(moreAvailable)data.coverage={returned:rows.size,total:data.total,incomplete:true,moreAvailable:true};
    }
    const notes=[...new Set(pages.flatMap(({result})=>result.limitations||[]))].filter(note=>
      data.coverage||(!note.startsWith('일부 날짜만 반환되었습니다.')&&!note.startsWith('일부 그룹만 반환되었습니다.')));
    if(notes.length)data.limitations=notes;
    return {name,args:conditions,result:data};
  });
}

export function buildAnswerInput(context) {
  const {results=[],...input}=context;
  for(const key of ['runId','catalog','toolSchemas'])delete input[key];
  const bases=new Map();
  for(const {result,args} of results)if(result.reportingBasis) {
    const role=result.scope?.scopeRole||args?.scopeRole||'primary';
    bases.set(role,result.reportingBasis);
  }
  if(bases.has('primary')&&input.scope?.periods) {
    input.scope={...input.scope};
    delete input.scope.periods;
  }
  const basis=bases.get('primary');
  if(bases.size) {
    input.reportingBasis=basis&&[...bases.values()].every(value=>JSON.stringify(value)===JSON.stringify(basis))?
      basis:[...bases].map(([scopeRole,basis])=>({scopeRole,basis}));
  }
  return withoutTrace({...input,results:answerResults(results)});
}
