import reviewTaxonomy from '../../../data/roas/roas-review-classification.json' with {type:'json'};
import {dashboardDimensions} from '../tools/metrics.mjs';

const need = {
  overview:['현재 조회 범위의 KPI 한 개 값만 요청해도 이 도구를 선택한다. 전체 KPI 값, 두 기간의 변화 또는 그룹 비교의 전체 기준선이 필요할 때도 선택한다. ROAS 하락 원인과 개선 우선순위에는 캠페인별 값과 별도로 전체 ROAS 기준선이 필요하다.',
    '전체 기간 집계나 전체 기준선이 필요 없고 명시된 산식, 그룹별 값 또는 일별 흐름만으로 충분하다.'],
  metric_components:['지원되는 지표의 산식, 분자·분모나 계산 구성값 자체를 명시적으로 요청한다. 다른 조회와 별개로 산식 설명이 필요하다.',
    '산식을 요청하지 않은 원인 진단이나 값 비교다. overview와 metric_breakdown은 분자와 분모를 이미 반환한다. 미지원 지표의 산식 요청은 unresolved로 처리하고 이 도구를 선택하지 않는다.'],
  metric_breakdown:['그룹별 값, 순위 또는 기간 증감을 따로 비교해야 한다.',
    '캠페인이나 기기가 언급돼도 적용된 필터의 전체값만 필요하다.'],
  trend:['일별 추이를 명시했거나, 원인 분석과 개선 우선순위처럼 시간 흐름을 확인해야 한다. 원인·왜·개선을 묻는 분석에는 기간 집계만으로 사건 전후 변화 시점을 검증할 수 없으므로 일별 추이 확인이 필요하다.',
    '직접 값·순위·그룹 비교만 요청하고 일별 시점이나 원인 분석, 개선 근거 확인이 전혀 필요하지 않다.'],
  records:['왜 변했는지, 원인 후보 또는 개선 우선순위를 판단하려면 캠페인 설정, 운영 변경 및 장애 기록의 사실·시점 확인이 필요하다. 기록과 성과의 동시 발생은 인과 증거가 아니다.',
    '성과 값, 산식, 그룹 비교만 요청하고 운영 원인이나 개선 결정에는 관심이 없다.'],
  review_summary:['리뷰 건수, 평균 평점 또는 주제, 판매처, 기간별 집계가 필요하다.',
    '개별 원문 또는 다른 자료만 필요하다.'],
  review_records:['실제 리뷰 원문, 개별 사례 또는 인용이 필요하다.',
    '리뷰 집계 또는 다른 자료만으로 충분하다.'],
  evidence:['이미 제시된 특정 근거 ID의 원천을 다시 확인해야 한다.',
    '이번 답변에서 일반적인 조회 근거를 사용하면 충분하다.']
};
const metricNeeds={roas:'유료 마케팅 집행비 대비 귀속 구매 매출',spend:'유료 마케팅 집행비 규모',
  revenue:'귀속 구매 매출액',orders:'귀속 구매 주문 건수',clicks:'클릭 횟수',cpc:'클릭 한 번당 집행비',
  cvr:'클릭 대비 구매 주문 비율. 세션 기준 구매율과 구분',cpa:'구매 주문 한 건당 집행비. 신규 고객 획득 비용과 구분',
  aov:'주문당 평균 구매금액',adCtr:'광고 노출 대비 광고 클릭 비율. 콘텐츠 조회 기준과 구분',
  paymentFailureRate:'결제 시도 대비 실패 비율',contentClickRate:'콘텐츠 조회 대비 링크 클릭 비율',
  adCpm:'광고 노출 1,000회당 비용',contentCpm:'콘텐츠 조회 1,000회당 비용'};
const metricTools=['metric_components','metric_breakdown','trend'];
const metricScope={
  catalog:'명시했거나 문맥에서 지칭한 성과 지표와 조회 조건을 현재 목록과 범위로 표현할 수 있다.',
  general_roas:'특정 지표를 명시하거나 지칭하지 않고 일반 광고 효율을 묻는다.',
  unresolved:'요청한 지표, 분석 단위, 필터 또는 기간에 목록이나 현재 범위 밖 조건이 있거나 의미를 확정할 수 없다. 다른 조건이 유효해도 선택한다.',
  not_applicable:'광고 성과 지표 조회가 필요하지 않다.'
};
const trendPeriods={current:'현재 분석 기간의 일별 흐름만 필요하다.',baseline:'직전 비교 기간의 일별 흐름만 필요하다.',
  both:'두 기간의 일별 흐름 비교가 필요하거나 별도 기간 지정 없이 변곡 시점을 묻는다.',
  not_needed:'이 지표는 다른 도구에만 필요하거나 기간 집계만으로 충분하다.',
  unresolved:'필요한 기간을 원문과 최근 대화에서 특정할 수 없거나 화면의 두 기간으로 표현할 수 없다.'};
const decisionRules='state.user_question의 의미를 판단하세요. 지칭은 state.recent_history로 해석하세요. '
  +'화면 정보는 조회 범위입니다. 답에 직접 필요한 자료만 고르고, 범위 밖 조건을 현재 범위로 바꾸지 마세요.';
const dimensionLabels={campaign:'캠페인',device:'기기',audienceId:'같은 타깃을 캠페인에 걸쳐 합산한 타깃',
  creativeId:'소재',placement:'게재 위치',keyword:'검색어'};
const recordLabels={campaign:'캠페인 설정',change:'운영 변경',creative:'소재 변경',incident:'장애와 점검',
  inventory:'상품과 재고',landing:'랜딩 페이지',tracking:'계측 설정'};
const periods={baseline:'직전 비교 기간',current:'현재 분석 기간'};
const probability=value=>Number.isFinite(value)&&value>=0&&value<=1;
const high=value=>value>=0.7;
const low=value=>value<=0.3;
const choiceOf=answer=>high(answer?.probabilities?.[answer.choice])?answer.choice:undefined;
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

export function firstJevRequest(state,toolRuntime,options,catalog) {
  const tools=Object.fromEntries(toolRuntime.toolSchemas({workflow:'jev'}).map(({name,description})=>[name,{description,
    availability:name==='evidence'?'requires_issued_id':name.startsWith('review_')?(options.reviewStatus||'not_provided'):'available'}]));
  const context='사용자의 원본 질문: '+JSON.stringify(state.user_question)+'. 현재 데이터 값은 아직 조회하지 않았으며 state.scope는 조회 범위 정보입니다. ';
  const questions={route:{type:'choice',instructions:context+'원문 질문이 요구하는 답변의 깊이를 고르세요.',
    criteria:{quick:'값, 순위, 증감 또는 직접 비교를 요청한다.',deep:'원인, 여러 근거의 관계, 진단이나 개선 방안을 요청한다.'}}};
  for(const [name,[yes,no]] of Object.entries(need))
    questions['need_'+name]=noul(context+'도구 '+name+'는 '+tools[name].description+'를 반환합니다. 원문에 답하려면 이 도구의 자료가 필요한가요?',yes,no);
  const metric_options=Object.fromEntries((catalog.metricCapabilities||[]).filter(metric=>metric.availability==='ready')
    .map(metric=>[metric.id,{label:metric.label,meaning:metricNeeds[metric.id],
      dimensions:dashboardDimensions(metric.id,options.searchOnly).filter(d=>metric.availableDimensions.includes(d))}]));
  for(const [id,{label}] of Object.entries(metric_options))
    questions['metric_'+id]=noul(label+' 지표 자체를 독립적으로 산식 조회, 그룹 비교 또는 일별 추이로 요청했나요?',
      '원문에서 이 지표를 직접 명시했거나 직전 대화에서 지칭했다. 명시되지 않아도 이 지표 자체의 조회 없이는 질문을 해결할 수 없다.',
      '다른 지표의 계산에만 쓰이는 입력값이다. 예를 들어 ROAS의 매출·집행비, CVR의 주문·클릭은 해당 지표 조회에 이미 포함된다. 원인 분석에 관련 있다는 이유만으로 별도 지표를 선택하지 않는다. 개요에서 값만 확인할 지표도 제외한다.');
  questions.metric_scope={type:'choice',instructions:'원문의 지표, 차원, 필터와 기간을 지원 범위와 대조하세요. ROAS와 CVR, 직전(baseline) 일별 추이는 지원되며 CAC(신규 고객 획득 비용)는 지원 지표가 아닙니다. 지원되지 않는 요청을 CPA 등으로 대체하지 마세요.',criteria:metricScope};
  return {state:{...state,tools,metric_options,dimension_labels:dimensionLabels,decision_rules:decisionRules},questions};
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

export function firstPlan(answers,{metric_options}) {
  const selected=Object.keys(need).filter(name=>high(answers['need_'+name].noul));
  const scope=choiceOf(answers.metric_scope);
  const needsMetrics=selected.some(name=>metricTools.includes(name));
  const offeredMetrics=needsMetrics?Object.keys(metric_options):[];
  const metrics=offeredMetrics.filter(id=>high(answers['metric_'+id].noul));
  if(needsMetrics&&!metrics.length&&scope==='general_roas'&&metric_options.roas)
    metrics.push('roas');
  return {route:choiceOf(answers.route)||'deep',selected,metrics,scope,
    uncertainMetrics:offeredMetrics.filter(id=>!high(answers['metric_'+id].noul)&&!low(answers['metric_'+id].noul)).length,
    uncertain:Object.keys(need).filter(name=>!high(answers['need_'+name].noul)&&!low(answers['need_'+name].noul))};
}

export function optionJevRequest(state,selected,catalog,available,issued,selectedMetrics=[]) {
  const option_candidates={},questions={};
  const add=(id,tool,args,description,criterion=description)=>{
    option_candidates[id]={tool,args,description};
    questions[id]=noul('원본 질문: '+JSON.stringify(state.user_question)+'. '+tool+
      '는 1차에서 필요한 도구로 이미 선택됐습니다. 이 도구로 '+description+' 조회가 필요한가요?',criterion,
      '원문 질문의 목적과 현재 대시보드 범위를 고려하면 이 옵션을 조회할 필요가 없다.');
  };
  const metrics=(catalog.metricCapabilities||[]).filter(metric=>metric.availability==='ready'&&selectedMetrics.includes(metric.id));
  const searchTerms=[...new Set([...state.user_question.matchAll(/["“‘「『]([^"”’」』\n]{1,120})["”’」』]/gu)].map(match=>match[1]))]
    .filter(term=>!/[\\/]/u.test(term)).slice(0,8);
  for(const tool of selected) {
    if(tool==='metric_components')for(const metric of metrics) {
      const id='components_'+metric.id;
      option_candidates[id]={tool,args:{metric:metric.id}};
      questions[id]=noul(metric.label+' 지표 자체의 산식 또는 계산 내역을 별도로 설명해 달라는 요청인가요?',
        '사용자가 이 지표 자체의 산식, 구성값을 요청했다. 이 조회가 분자와 분모를 함께 반환한다.',
        '이 지표는 다른 산식의 입력값일 뿐 별도 산식을 요청하지 않았다. 예를 들어 ROAS 산식 설명에는 components_roas 하나면 충분하며 components_spend와 components_revenue는 불필요하다.');
    }
    if(tool==='metric_breakdown')for(const metric of metrics) {
      const dimensions=dashboardDimensions(metric.id,available.searchOnly).filter(d=>metric.availableDimensions.includes(d));
      for(const dimension of dimensions) {
        const id='breakdown_'+metric.id+'_'+dimension;
        option_candidates[id]={tool,args:{metric:metric.id,dimension}};
        questions[id]=noul(metric.label+'를 '+dimensionLabels[dimension]+'별로 비교해야 하나요?',
          '이 지표와 이 차원이 같은 조회에 연결되고, 잠긴 기간과 필터의 그룹별 값, 순위 또는 증감으로 요청을 충족한다.',
          '이 차원이 다른 지표에만 붙거나 이미 적용된 필터, 전체 집계면 충분한 경우 또는 잠긴 기간과 필터로 충족할 수 없는 요청이다.');
      }
    }
    if(tool==='trend')for(const metric of metrics) {
      const id='trend_'+metric.id+'_period';
      option_candidates[id]={tool,args:{metrics:[metric.id]}};
      questions[id]={type:'choice',instructions:'원문과 최근 대화에서 '+metric.label+' 자체의 일별 추이를 요청했는지 판정하세요. 직전 또는 이전 비교 기간이면 baseline, 현재면 current, 두 기간이나 기간 미지정 변곡 분석이면 both, 이 지표 추이가 필요 없으면 not_needed를 선택합니다. 분자·분모로 언급된 지표를 추이 대상으로 바꾸지 마세요.',criteria:trendPeriods};
    }
    if(tool==='records') {
      for(const category of available.recordCategories||[]) {
        const label=recordLabels[category]||category;
        add('records_'+category,tool,{category},label+' 기록',
          '사용자가 이 기록 분류만 조회하라고 명시적으로 범위를 제한했다. 일반적인 원인 분석이나 개선 순위를 물었다면 다른 분류의 설정, 사고, 추적 기록도 필요하므로 선택하지 않는다.');
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
  return {state:{...state,decision_rules:decisionRules,selected_tools:selected,option_candidates},questions};
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
    if(name==='metric_components'||name==='metric_breakdown') {
      for(const args of candidates)add(name,args);
      if(!candidates.length)missing.push(name);
    } else if(name==='trend') {
      const byPeriod=new Map();
      let unresolved=false;
      for(const [id,option] of Object.entries(request.state.option_candidates)) {
        if(option.tool!==name)continue;
        const [metric]=option.args.metrics;
        const periodId=choiceOf(answers[id]);
        if(periodId==='unresolved') {
          unresolved=true;
          missing.push(name+' ('+metric+')');
        }
        if(!['current','baseline','both'].includes(periodId))continue;
        if(!byPeriod.has(periodId))byPeriod.set(periodId,[]);
        byPeriod.get(periodId).push(metric);
      }
      for(const [periodId,metrics] of byPeriod)add(name,{metrics,periodId,granularity:'day'});
      if(!byPeriod.size&&!unresolved)missing.push(name);
    } else if(name==='evidence') {
      const evidenceIds=[...new Set(candidates.flatMap(args=>args.evidenceIds))];
      if(evidenceIds.length)add(name,{evidenceIds:evidenceIds.slice(0,24)});
      else missing.push(name);
    } else if(name==='records') {
      const chosen=specific(candidates);
      if(!chosen.some(args=>args.category&&args.query)&&grouped(chosen,'category').length===1&&grouped(chosen,'query').length===1) {
        add(name,Object.assign({},...chosen));continue;
      }
      for(const args of chosen.length?chosen:[{}])add(name,args);
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
