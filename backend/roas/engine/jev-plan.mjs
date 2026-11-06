import reviewTaxonomy from '../../../data/roas/roas-review-classification.json' with {type:'json'};

const need = {
  overview:'현재 조회 범위의 ROAS 같은 KPI 한 개의 값 또는 여러 KPI의 기간별 집계',
  metric_detail:'특정 지표의 계산 구성 또는 캠페인, 기기, 타깃 등 분석 단위별 비교',
  trend:'일별 흐름, 변곡 시점, 운영 변경 전후 비교',
  records:'실제 캠페인 설정, 운영 변경 또는 장애 기록의 내용이나 시점',
  review_summary:'리뷰 건수, 평균 평점 또는 주제, 판매처, 기간별 집계',
  review_records:'실제 리뷰 원문, 개별 사례 또는 원문 인용',
  evidence:'특정 근거 ID의 원천 재확인'
};
const dimensionLabels={campaign:'캠페인',device:'기기',audienceId:'같은 타깃을 캠페인에 걸쳐 합산한 타깃',
  creativeId:'소재',placement:'게재 위치',keyword:'검색어'};
const recordLabels={campaign:'캠페인 설정',change:'운영 변경',creative:'소재 변경',incident:'장애와 점검',
  inventory:'상품과 재고',landing:'랜딩 페이지',tracking:'계측 설정'};
const periods={baseline:'직전 비교 기간',current:'현재 분석 기간'};
const probability=value=>Number.isFinite(value)&&value>=0&&value<=1;
const high=value=>value>=0.7;
const low=value=>value<=0.3;
const protocolError=()=>Object.assign(Error('model_protocol'),{code:'model_protocol'});

function noul(instructions,yes,no='이 조건을 적용하지 않아도 원문 질문에 답할 수 있다.') {
  return {type:'noul',instructions,criteria:{true:yes,false:no}};
}

export function jevState(run,catalog) {
  const {caseId,snapshot,filters,metric,screenTitle}=run.scope;
  return {user_question:run.question,recent_history:run.history.slice(-4).map(item=>({...item,text:item.text.slice(0,1800)})),scope:{
    caseId,snapshot,filters,metric,screenTitle,periods:catalog.reportingBasis?.periods||[]
  }};
}

export function firstJevRequest(state,toolRuntime,options) {
  const tools=Object.fromEntries(toolRuntime.toolSchemas().map(({name,description})=>[name,{description,
    availability:name==='evidence'?'requires_issued_id':name.startsWith('review_')?(options.reviewStatus||'not_provided'):'available'}]));
  const context='사용자의 원본 질문: '+JSON.stringify(state.user_question)+'. 현재 데이터 값은 아직 조회하지 않았으며 state.scope는 조회 범위 정보입니다. ';
  const questions={route:{type:'choice',instructions:context+'원문 질문이 요구하는 답변의 깊이를 고르세요.',
    criteria:{quick:'값, 순위, 증감 또는 직접 비교를 요청한다.',deep:'원인, 여러 근거의 관계, 진단이나 개선 방안을 요청한다.'}}};
  for(const [name,criterion] of Object.entries(need)) {
    questions['need_'+name]=noul(context+'도구 '+name+'는 '+tools[name].description+'를 반환합니다. 원문 질문에 답하려면 '+criterion+' 자료를 조회해야 하나요?',
      criterion+' 자료가 요청을 충족하는 데 필요하다.',
      '이 도구가 제공하는 값이나 원문이 요청에 관련 없거나, 다른 도구의 결과만으로 충분하다.');
  }
  return {state:{...state,tools},questions};
}

export function readJevAnswers(request,output) {
  const answers=output?.answers;
  if(!answers||Object.keys(answers).length!==Object.keys(request.questions).length)throw protocolError();
  for(const [id,question] of Object.entries(request.questions)) {
    const answer=answers[id];
    if(answer?.type!==question.type)throw protocolError();
    if(question.type==='noul'&&!probability(answer.noul))throw protocolError();
    if(question.type==='choice'&&(!Object.hasOwn(question.criteria,answer.choice)||!probability(answer.confidence)||
      Object.keys(answer.probabilities||{}).length!==Object.keys(question.criteria).length||
      Object.keys(question.criteria).some(key=>!probability(answer.probabilities?.[key]))||
      Object.values(answer.probabilities).some(value=>value>answer.probabilities[answer.choice])||
      Math.abs(Object.values(answer.probabilities).reduce((sum,value)=>sum+value,0)-1)>0.01))throw protocolError();
  }
  return answers;
}

export function firstPlan(answers) {
  return {route:high(answers.route.probabilities[answers.route.choice])?answers.route.choice:'deep',
    selected:Object.keys(need).filter(name=>high(answers['need_'+name].noul)),
    uncertain:Object.keys(need).filter(name=>!high(answers['need_'+name].noul)&&!low(answers['need_'+name].noul))};
}

function dashboardDimensions(id,searchOnly) {
  if(id==='adCtr')return ['creativeId','placement','audienceId',...(searchOnly?['keyword']:[])];
  if(id==='cpc')return ['campaign','placement','audienceId',...(searchOnly?['keyword']:[])];
  return ['roas','cvr','cpa','aov'].includes(id)?['campaign','device','audienceId']:[];
}

export function optionJevRequest(state,selected,catalog,available,issued) {
  const option_candidates={},questions={};
  const add=(id,tool,args,description,criterion=description)=>{
    option_candidates[id]={tool,args,description};
    questions[id]=noul('원본 질문: '+JSON.stringify(state.user_question)+'. '+tool+
      '는 1차에서 필요한 도구로 이미 선택됐습니다. 이 도구로 '+description+' 조회가 필요한가요?',criterion,
      '원문 질문의 목적과 현재 대시보드 범위를 고려하면 이 옵션을 조회할 필요가 없다.');
  };
  const metrics=(catalog.metricCapabilities||[]).filter(metric=>metric.availability==='ready');
  const metricTools=selected.some(name=>['metric_detail','trend'].includes(name));
  if(metricTools)questions.metric_specified=noul('사용자가 ROAS, 전환율 등 특정 성과 지표를 지정했나요?',
    '질문 또는 지칭 대상에서 특정 지표를 알 수 있다.','일반 성과만 물었으며 지표를 지정하지 않았다.');
  const searchTerms=[...new Set([...state.user_question.matchAll(/["“‘「『]([^"”’」』\n]{1,120})["”’」』]/gu)].map(match=>match[1]))]
    .filter(term=>!/[\\/]/u.test(term)).slice(0,8);
  for(const tool of selected) {
    if(tool==='metric_detail')for(const metric of metrics) {
      const dimensions=dashboardDimensions(metric.id,available.searchOnly).filter(d=>metric.availableDimensions.includes(d));
      for(const dimension of ['overall',...dimensions]) {
        const label=dimension==='overall'?'분해 없는 전체':dimensionLabels[dimension]+'별';
        const metricLabel=metric.id==='roas'?metric.label+' 또는 지표를 생략한 일반 성과':metric.label;
        add('detail_'+metric.id+'_'+dimension,tool,{metric:metric.id,...(dimension==='overall'?{}:{dimension})},
          label+' '+metricLabel, '이 지표와 분석 단위의 짝을 요청했다.');
      }
    }
    if(tool==='trend')for(const metric of metrics)for(const [periodId,label] of Object.entries(periods)) {
      add('trend_'+metric.id+'_'+periodId,tool,{metrics:[metric.id],periodId},label+' '+metric.label+'의 일별 추이',
        '이 지표의 이 기간 일별 흐름이 필요하다. 기간이 없으면 현재 대시보드의 두 기간을 고려한다.');
    }
    if(tool==='records') {
      for(const category of available.recordCategories||[]) {
        const label=recordLabels[category]||category;
        add('records_'+category,tool,{category},label+' 기록');
        searchTerms.forEach((query,i)=>add('records_'+category+'_query_'+i,tool,{category,query},'“'+query+'”로 좁힌 '+label+' 기록'));
      }
    }
    if(tool.startsWith('review_')&&available.reviewStatus==='ready') {
      for(const source of available.reviewSources||[]) {
        add(tool+'_source_'+source.sourceId,tool,{sourceId:source.sourceId},source.sourceName+'의 리뷰');
        for(const [periodId,label] of Object.entries(periods))
          add(tool+'_source_'+source.sourceId+'_'+periodId,tool,{sourceId:source.sourceId,periodId},source.sourceName+'의 '+label+' 리뷰',
            '이 판매처와 기간을 하나의 조건으로 함께 지정했다.');
      }
      for(const [periodId,label] of Object.entries(periods))add(tool+'_period_'+periodId,tool,{periodId},label+'의 리뷰');
      const topics=[...(available.reviewCategories||[]).map(({categoryId})=>['categoryId',categoryId,reviewTaxonomy.categories.find(x=>x.id===categoryId)?.label])];
      if(tool==='review_records')topics.push(...(available.reviewExperiences||[]).map(({experienceId})=>
        ['experienceId',experienceId,reviewTaxonomy.experiences.find(x=>x.id===experienceId)?.label]));
      for(const [key,id,label] of topics) {
        add(tool+'_'+key+'_'+id,tool,{[key]:id},label+' 주제의 리뷰');
        if(tool==='review_records')for(const sentiment of reviewTaxonomy.sentiments)
          add(tool+'_'+key+'_'+id+'_'+sentiment.id,tool,{[key]:id,sentiment:sentiment.id},label+'에 관한 '+sentiment.label+' 리뷰',
            '이 주제나 세부 경험에 대한 이 감성을 하나의 조건으로 요청했다.');
      }
      if(tool==='review_records') {
        for(const sentiment of reviewTaxonomy.sentiments)add(tool+'_sentiment_'+sentiment.id,tool,{sentiment:sentiment.id},sentiment.label+' 리뷰');
        for(const id of available.reviewIds||[])if(state.user_question.includes(id))add(tool+'_id_'+id,tool,{reviewIds:[id]},id+' 리뷰 원문');
      }
    }
    if(['records','review_records'].includes(tool))searchTerms.forEach((query,i)=>add(tool+'_query_'+i,tool,{query},'“'+query+'”가 들어간 자료'));
    if(tool==='evidence')for(const id of issued)
      add('evidence_'+id,tool,{evidenceIds:[id]},id+'의 원천','원문에서 이 ID 또는 이 ID가 연결된 자료의 확인을 요청했다.');
  }
  return {state:{...state,selected_tools:selected,option_candidates},questions};
}

function specific(candidates) {
  return candidates.filter(args=>!candidates.some(other=>Object.keys(other).length>Object.keys(args).length&&
    Object.entries(args).every(([key,value])=>other[key]===value)));
}

function grouped(candidates,key) {
  return candidates.filter(args=>Object.hasOwn(args,key));
}

export function optionCalls(request,answers,selected) {
  const calls=[],missing=[];
  const add=(name,args)=>calls.push({name,args});
  for(const name of selected) {
    const candidates=Object.entries(request.state.option_candidates).filter(([id,option])=>option.tool===name&&high(answers[id]?.noul))
      .map(([,option])=>option.args);
    if(name==='metric_detail') {
      if(candidates.length)for(const args of specific(candidates))add(name,args);
      else if(low(answers.metric_specified?.noul))add(name,{metric:'roas'});
      else missing.push(name);
    } else if(name==='trend') {
      const byMetric=new Map();
      for(const {metrics:[metric],periodId} of candidates) {
        if(!byMetric.has(metric))byMetric.set(metric,new Set());
        byMetric.get(metric).add(periodId);
      }
      const byPeriod=new Map();
      for(const [metric,values] of byMetric) {
        const periodId=values.size===2?'both':[...values][0];
        if(!byPeriod.has(periodId))byPeriod.set(periodId,[]);
        byPeriod.get(periodId).push(metric);
      }
      for(const [periodId,metrics] of byPeriod)add(name,{metrics,periodId,granularity:'day'});
      if(!byPeriod.size) {
        if(low(answers.metric_specified?.noul))add(name,{metrics:['roas'],granularity:'day'});
        else missing.push(name);
      }
    } else if(name==='evidence') {
      const evidenceIds=[...new Set(candidates.flatMap(args=>args.evidenceIds))];
      if(evidenceIds.length)add(name,{evidenceIds:evidenceIds.slice(0,24)});
      else missing.push(name);
    } else if(name==='records') {
      const chosen=specific(candidates);
      if(!chosen.some(args=>args.category&&args.query)&&grouped(chosen,'category').length===1&&grouped(chosen,'query').length===1) {
        add(name,Object.assign({},...chosen));continue;
      }
      if(chosen.length)for(const args of chosen)add(name,args);
      else add(name,{});
    } else {
      const scope=specific(candidates.filter(args=>args.sourceId||args.periodId));
      const paired=scope.filter(args=>args.sourceId&&args.periodId);
      const source=grouped(scope,'sourceId'),period=grouped(scope,'periodId');
      let slices=scope;
      if(!paired.length&&source.length&&period.length) {
        if(source.length===1||period.length===1)
          slices=source.flatMap(s=>period.map(p=>({...s,...p})));
        else {missing.push(name);continue;}
      }
      const topics=specific(candidates.filter(args=>args.categoryId||args.experienceId||args.sentiment));
      const queries=grouped(candidates,'query');
      const reviewIds=[...new Set(candidates.flatMap(args=>args.reviewIds||[]))];
      const filters=topics.length?topics:[{}];
      if([slices.length,filters.length,queries.length].filter(length=>length>1).length>1) {
        missing.push(name);continue;
      }
      for(const slice of slices.length?slices:[{}])for(const topic of filters)for(const query of queries.length?queries:[{}])
        add(name,{...slice,...topic,...query,...(reviewIds.length?{reviewIds:reviewIds.slice(0,24)}:{})});
    }
  }
  return {calls,missing};
}
