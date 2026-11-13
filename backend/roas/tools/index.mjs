import {createHash} from 'node:crypto';
import {trainingScreenData} from '../../../scripts/roas/training-data.mjs';
import {reviewQuery} from '../../../scripts/roas/review-data.mjs';
import {
  campaignDisplayName, comparePeriods, selectFacts, selectRecords, summarize,
  trainingCaseIds, trainingCostDefinition, metricMissingReason,
} from '../../../shared/roas/training-dashboard.mjs';
import {chatValue} from '../../../shared/roas/roas-chat.mjs';
import {roasImpactPp,roasScopeDeltaPp} from '../../../shared/roas/roas-impact.mjs';
import {dashboardDimensions, dimensions, dimensionRows, groupKey, keyFor, metricCapabilities, metricResult, metricRows, metrics} from './metrics.mjs';

const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const clone = value => structuredClone(value);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const allowed = (object, keys) => isObject(object) && Object.keys(object).every(key => keys.includes(key));
const dates = ['baseline', 'current'];
const sources = ['all', 'own_store', 'virtual_external_1'];
const isSearchOnly = (pack, facts) => facts.length > 0 &&
  facts.every(row => pack.data.campaigns.find(campaign => campaign.id === row.campaignId)?.channel === 'search');
const periodOption = ['both', ...dates];
const limits = (args, total) => {
  const offset = args.offset ?? 0, limit = args.limit ?? 24;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > total ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 24) fail('request_invalid');
  return {offset, limit, nextOffset: offset + limit < total ? offset + limit : null,
    truncated: offset + limit < total};
};
const searchQuery = value => {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 120 || /[\r\n\\/]|:\/\/|\bselect\b.*\bfrom\b|\b(?:delete|drop|insert|update)\b\s+\w+/i.test(value)) fail('request_invalid');
  return value.trim().toLocaleLowerCase();
};
const asRecord = (record, evidenceId) => ({
  evidenceId, recordId: record.id, date: record.date, category: record.category,
  campaignId: record.campaignId, device: record.device, productId: record.productId,
  title: record.title, values: clone(record.values),
});
const inPeriod = (date, period) => date >= period.start && date < period.end;
const pickPeriods = (pack, periodId = 'both') => pack.data.periods.filter(period => periodId === 'both' || period.id === periodId);
const meta = (pack, role) => ({
  scope: {...clone(pack.scope), scopeRole: role},
  reportingBasis: {
    asOf: pack.data.asOf, timezone: 'Asia/Seoul', periodEndExclusive: true,
    periods: clone(pack.data.periods), attribution: '최근 7일 유료 클릭 귀속, 클릭일 기준',
    cost: trainingCostDefinition, breakdownCosts: '상품/트래픽 비용은 승인된 합성 배분값',
    reviewPeriod: '작성일', reviewCutoff: '수집일은 asOf 미만',
  },
  sourceVersion: {roas: pack.data.contract, manifestHash: pack.data.dataHash,
    review: pack.review?.status ?? 'error', taxonomy: pack.review?.classificationVersion ?? null},
  dataHash: pack.hash, sourceHash: pack.sourceHash,
  evidenceIds: [], limitations: [],
});
const definition = id => ({
  label: metrics[id].label, formula: metrics[id].formula,
  numeratorField: metrics[id].numeratorField, denominatorField: metrics[id].denominatorField,
  unit: metrics[id].unit, components: metrics[id].components,
});
const schema = (name, description, props, required = ['scopeRole']) => ({
  name, description,
  parameters: {type: 'object', properties: props, required, additionalProperties: false},
});
const textEnum = values => ({type:'string', enum:values});
const numberProp = {type:'integer', minimum:0};
const paging = {offset:numberProp, limit:{type:'integer', minimum:1, maximum:24}};
const safeQuery = {type:'string', maxLength:120};
const commonProps = roles => ({scopeRole:textEnum(roles)});

function validScope(request, data) {
  if (!isObject(request) || !trainingCaseIds.includes(request.caseId) ||
      !['initial','mature'].includes(request.snapshot) ||
      !allowed(request.filters, ['channel','source','campaignId','device']) ||
      !['all','mobile','desktop'].includes(request.filters.device) ||
      !['channel','source','campaignId'].every(key => typeof request.filters[key] === 'string') ||
      !['channel','source'].every(key => request.filters[key] === 'all' ||
        data.campaigns.some(campaign => campaign[key] === request.filters[key])) ||
      (request.filters.campaignId !== 'all' && !data.campaigns.some(campaign => campaign.id === request.filters.campaignId))) {
    fail('unsupported_scope');
  }
  if (!data.campaigns.some(campaign =>
    (request.filters.campaignId === 'all' || request.filters.campaignId === campaign.id) &&
    (request.filters.channel === 'all' || request.filters.channel === campaign.channel) &&
    (request.filters.source === 'all' || request.filters.source === campaign.source))) fail('unsupported_scope');
}
// The server supplies run identity, scope and data loader. Model arguments cannot select files or dates.
export async function createToolRuntime({directory, scope, runId, issuedAt, now = () => new Date(), sourceLoader} = {}) {
  if (typeof runId !== 'string' || !runId.trim() || runId.length > 128 ||
      !isObject(scope) || (sourceLoader !== undefined && typeof sourceLoader !== 'function')) fail('request_invalid');
  const inputScopes = isObject(scope.primary) ? scope : {primary: scope, ...(scope.comparison ? {comparison:scope.comparison} : {})};
  if (!allowed(inputScopes, ['primary','comparison']) || !isObject(inputScopes.primary)) fail('request_invalid');
  const snapshots = new Map(), issued = new Map();
  const start = issuedAt ?? (typeof now === 'function' ? now() : now);
  const startedAt = start instanceof Date ? start.toISOString() : start;
  if (!Number.isFinite(Date.parse(startedAt))) fail('request_invalid');
  for (const [role, rawScope] of Object.entries(inputScopes)) {
    if (!['primary','comparison'].includes(role) || !isObject(rawScope) ||
        !trainingCaseIds.includes(rawScope.caseId) || !['initial','mature'].includes(rawScope.snapshot)) fail('request_invalid');
    const loaded = sourceLoader
      ? await sourceLoader({directory, caseId:rawScope.caseId, snapshot:rawScope.snapshot, scopeRole:role})
      : {data:trainingScreenData(directory, rawScope.caseId, rawScope.snapshot),
         review:reviewQuery({caseId:rawScope.caseId, snapshotId:rawScope.snapshot}, directory)};
    if (!isObject(loaded) || !isObject(loaded.data)) fail('data_unavailable');
    const data = clone(loaded.data);
    validScope(rawScope, data);
    const hash = sha256(data);
    const review = clone(loaded.review ?? {status:'error',reviews:[]});
    const filters = clone(rawScope.filters);
    const lockedScope = freeze({caseId:rawScope.caseId, snapshot:rawScope.snapshot,
      filters, dataHash:hash, ...(rawScope.metric ? {metric:rawScope.metric} : {})});
    const pack = {data:freeze(data), review:freeze(review), scope:lockedScope, hash,
      sourceHash:sha256({dataHash:hash, review, filters}),
      reviewsById:new Map((review.reviews??[]).map(row=>[row.id,row]))};
    snapshots.set(role, pack);
  }
  let disposed = false, sequence = 0;
  const getPack = role => {
    if (disposed) fail('runtime_disposed');
    if (!snapshots.has(role)) fail('unsupported_scope');
    return snapshots.get(role);
  };
  const base = (role='primary') => meta(getPack(role), role);
  function issue(pack, role, kind, source, rows, periodId, payload = {}) {
    const evidenceId = 'EV-' + sha256(runId).slice(0,12) + '-' + (++sequence);
    const item = freeze({
      evidenceId, runId, role, kind, source, periodId, issuedAt:startedAt,
      sourceHash:pack.sourceHash,
      sourceRecordIds:rows.map(row => row.id), payload:clone(payload),
    });
    issued.set(evidenceId, item);
    return evidenceId;
  }
  function evidenceItems(evidenceIds=[]) {
    if(disposed)fail('runtime_disposed');
    return evidenceIds.flatMap(id=>{
      const item=issued.get(id);
      return item?[{
        evidenceId:item.evidenceId,kind:item.kind,sourceRecordIds:clone(item.sourceRecordIds),
        scopeRole:item.role,periodId:item.periodId,sourceHash:item.sourceHash,
        sourceVersion:snapshots.get(item.role).data.dataHash,
        ...(item.kind==='record'||item.kind==='review_record'
          ?{rawRecord:clone(item.payload)}:{summary:clone(item.payload)})
      }]:[];
    });
  }
  function toolSchemas({workflow} = {}) {
    if (disposed) fail('runtime_disposed');
    const roles = [...snapshots.keys()], scoped = commonProps(roles);
    const offered = [...new Set([...snapshots.values()].flatMap(pack => {
      const catalog=metricCapabilities(pack.data,pack.scope.filters);
      if(workflow!=='jev')return catalog.flatMap(row=>row.availableDimensions);
      const searchOnly=isSearchOnly(pack,selectFacts(pack.data,pack.scope.filters));
      return catalog.flatMap(row=>dashboardDimensions(row.id,searchOnly).filter(dimension=>row.availableDimensions.includes(dimension)));
    }))];
    const metricList = Object.keys(metrics);
    const period = {periodId:textEnum(periodOption)};
    const reviewProps = {
      ...scoped, productId:textEnum(['EDU-P1']), sourceId:textEnum(sources),
      ...period, categoryId:{type:'string'},
    };
    return [
      schema('overview','기간별 전체 KPI, 분자와 분모, ROAS 및 리뷰 제공 상태',
        {...scoped,metrics:{type:'array',items:textEnum(metricList),minItems:1,maxItems:metricList.length,uniqueItems:true}}),
      ...(workflow === 'jev' ? [
        schema('metric_components','지표 하나의 산식, 단위, 직전과 현재의 분자, 분모와 계산값',
          {...scoped,metric:textEnum(metricList)},['scopeRole','metric']),
        schema('metric_breakdown','지표 하나를 한 분석 단위로 나눈 그룹별 직전, 현재와 증감',
          {...scoped,metric:textEnum(metricList),dimension:textEnum(offered),...paging},['scopeRole','metric','dimension']),
      ] : [schema('metric_detail','지표 세부 데이터 조회: 산식, 기초 필드, 직전/현재, 지표별 제공 차원',
        {...scoped,metric:textEnum(metricList),dimension:textEnum(offered),...paging},['scopeRole','metric'])]),
      schema('trend','승인된 기간의 실제 일별 ROAS 등 지표 추이',
        {...scoped,metrics:{type:'array',items:textEnum(metricList),minItems:1,maxItems:metricList.length,uniqueItems:true},
          granularity:textEnum(['day']),...period,...paging},workflow==='jev'?['scopeRole','metrics','periodId']:undefined),
      schema('records','광고 운영 변경 기록 원문, 시점은 인과 증거가 아님',
        {...scoped,category:{type:'string'},query:safeQuery,...paging}),
      schema('review_summary','S16/S17 쓱쓱샴푸 리뷰 기간/판매처별 분류 집계',
        reviewProps),
      schema('review_records','쓱쓱샴푸 리뷰 원문, 작성일/수집일과 검수된 인용',
        {...reviewProps,experienceId:{type:'string'},sentiment:textEnum(['positive','negative','neutral','mixed']),
          reviewIds:{type:'array',items:{type:'string'},minItems:1,maxItems:24,uniqueItems:true},
          query:safeQuery,...paging}),
      schema('evidence','같은 run에서 발행한 근거 ID로 조회 결과를 다시 읽기',
        {evidenceIds:{type:'array',items:{type:'string'},minItems:1,maxItems:24,uniqueItems:true}},
        ['evidenceIds']),
    ];
  }
  function metricCatalog(scopeRole = 'primary') {
    const pack = getPack(scopeRole);
    const metricCapabilitiesList = metricCapabilities(pack.data, pack.scope.filters);
    return clone({...meta(pack,scopeRole), metricCapabilities:metricCapabilitiesList,
      supportedDimensions:[...new Set(metricCapabilitiesList.flatMap(row => row.availableDimensions))]});
  }
  function validate(name, args) {
    if (disposed) fail('runtime_disposed');
    if (!isObject(args)) fail('request_invalid');
    const keys = {
      overview:['scopeRole','metrics'], metric_detail:['scopeRole','metric','dimension','offset','limit'],
      metric_components:['scopeRole','metric'], metric_breakdown:['scopeRole','metric','dimension','offset','limit'],
      trend:['scopeRole','metrics','granularity','periodId','offset','limit'],
      records:['scopeRole','category','query','offset','limit'],
      review_summary:['scopeRole','productId','sourceId','periodId','categoryId'],
      review_records:['scopeRole','productId','sourceId','periodId','categoryId','experienceId','sentiment','reviewIds','query','offset','limit'],
      evidence:['evidenceIds'],
    };
    if (!Object.hasOwn(keys,name)) fail('tool_unknown');
    if (!allowed(args, keys[name])) fail('request_invalid');
    if (name === 'evidence') return;
    if (!snapshots.has(args.scopeRole)) fail('unsupported_scope');
    if (args.metrics !== undefined && (!Array.isArray(args.metrics) || !args.metrics.length ||
        args.metrics.length > Object.keys(metrics).length ||
        new Set(args.metrics).size !== args.metrics.length ||
        args.metrics.some(metric => !(metric in metrics)))) fail('request_invalid');
    if (['metric_detail','metric_components','metric_breakdown'].includes(name) && !Object.hasOwn(metrics,args.metric))
      fail('unsupported_metric');
    if ((name === 'metric_breakdown' || name === 'metric_detail' && args.dimension !== undefined) &&
        !dimensions.includes(args.dimension)) fail('unsupported_scope');
    if (name === 'trend' && args.granularity !== undefined && args.granularity !== 'day') fail('unsupported_scope');
    if (['trend','review_summary','review_records'].includes(name) &&
        args.periodId !== undefined && !periodOption.includes(args.periodId)) fail('unsupported_scope');
    if (['records','review_records'].includes(name)) searchQuery(args.query);
    if (['review_summary','review_records'].includes(name)) {
      if (args.productId !== undefined && args.productId !== 'EDU-P1' ||
          args.sourceId !== undefined && !sources.includes(args.sourceId)) fail('unsupported_scope');
    }
    if (['metric_detail','metric_breakdown','trend','records','review_records'].includes(name) &&
        (args.offset !== undefined && (!Number.isSafeInteger(args.offset) || args.offset < 0) ||
         args.limit !== undefined && (!Number.isSafeInteger(args.limit) || args.limit < 1 || args.limit > 24))) fail('request_invalid');
  }
  function overview(pack,role,args) {
    const chosenMetrics = args.metrics ?? Object.keys(metrics);
    const selected = comparePeriods(pack.data, pack.scope.filters);
    const periods = selected.map(({period,rows,total}) => {
      const evidenceId = rows.length ? issue(pack,role,'summary','facts',rows,period.id,
        {totals:total, rowCount:rows.length}) : null;
      return {...clone(period),totals:total,
        components:Object.fromEntries(chosenMetrics.map(metric => [metric,metricResult(rows,metric)])),
        display:Object.fromEntries(chosenMetrics.map(metric => [metric,chatValue(total.rates[metric] ?? total[metric] ?? null,metric)])),
        rowCount:rows.length,evidenceId};
    });
    const availability = Object.fromEntries(metricCapabilities(pack.data,pack.scope.filters)
      .filter(row => chosenMetrics.includes(row.id)).map(row => [row.id,row.availability]));
    const status = periods.some(period => period.rowCount) ? 'ready' : 'empty';
    return {...base(role),status,periods,availability,
      reviewAvailability:pack.review?.status === 'ready' ? 'ready' : pack.review?.status,
      evidenceIds:periods.map(period => period.evidenceId).filter(Boolean),
      limitations:status === 'empty' ? ['선택된 필터의 원천 행이 없습니다.'] : []};
  }
  function metricScope(pack,role,args) {
    const capabilities = metricCapabilities(pack.data,pack.scope.filters).find(row => row.id === args.metric);
    return {...base(role),metric:args.metric,metricDefinition:definition(args.metric),status:capabilities.availability,
      availability:capabilities.availability,relatedMetrics:capabilities.relatedMetrics,
      supportedDimensions:capabilities.availableDimensions,limitations:[...capabilities.limitations]};
  }
  function metricComponents(pack,role,args,scope=metricScope(pack,role,args)) {
    if (scope.status !== 'ready') return {...scope,periods:[]};
    const facts = selectFacts(pack.data,pack.scope.filters);
    const periods = pack.data.periods.map(period => {
      const rows = metricRows(facts.filter(row => row.periodId === period.id),args.metric);
      const result = metricResult(rows,args.metric);
      const evidenceId = issue(pack,role,'metric','facts',rows,period.id,
        {metric:args.metric, ...result});
      return {id:period.id,start:period.start,end:period.end,...result,evidenceId};
    });
    const output = {...scope,periods,evidenceIds:periods.map(row=>row.evidenceId),limitations:[...scope.limitations]};
    if (periods.some(period => period.denominator === 0)) {
      output.limitations.push(metricMissingReason(facts,args.metric).reason);
    }
    return output;
  }
  function metricGroups(pack,role,args,withDelta=false) {
    const {dimension,metric}=args;
    const dimensionData = metricRows(dimensionRows(pack.data,pack.scope.filters,dimension),metric);
    const impactScope = metric === 'roas' && dimension === 'campaign'
      ? Object.fromEntries(dates.map(id => [id,summarize(dimensionData.filter(row => row.periodId === id))]))
      : null;
    const keys = [...new Set(dimensionData.map(row=>groupKey(keyFor(row,dimension))))].sort();
    const {offset,limit,nextOffset,truncated} = limits(args,keys.length);
    const groups = keys.slice(offset,offset+limit).map(key => {
      const pairs = Object.fromEntries(pack.data.periods.map(period => {
        const rows = dimensionData.filter(row => row.periodId === period.id &&
          groupKey(keyFor(row,dimension)) === key);
        const calculated = metricResult(rows,metric);
        if (withDelta && !rows.length) calculated.value=null;
        const evidenceId = issue(pack,role,'metric',dimension === 'campaign' || dimension === 'device' ? 'facts':'breakdowns',
          rows,period.id,{metric,dimension,key,...calculated});
        return [period.id,{...calculated,evidenceId}];
      }));
      const label = dimension === 'campaign' ? campaignDisplayName(pack.data,key) :
        dimension === 'product' ? pack.data.products.find(p=>p.id===key)?.label ?? key :
        key === '__unspecified__' ? '미기록' : key;
      const {current,baseline}=pairs;
      return {key,label,...pairs,...(withDelta ? {delta:Number.isFinite(current.value) && Number.isFinite(baseline.value)
        ? current.value-baseline.value : null} : {}),
        ...(withDelta && impactScope ? {impactPp:roasImpactPp(impactScope.baseline,impactScope.current,
          {revenue:baseline.numerator,spend:baseline.denominator},
          {revenue:current.numerator,spend:current.denominator})} : {})};
    });
    const limitations=['서로 다른 분해 차원을 중복 합산하지 않습니다.'];
    if (dimension === 'product' || dimensions.indexOf(dimension) >= 3)
      limitations.push('상품/트래픽의 집행비는 합성 배분 원천입니다.');
    if (truncated) limitations.push('일부 그룹만 반환되었습니다. 다음 페이지를 확인해야 전체입니다.');
    return {dimension,groups,total:keys.length,nextOffset,truncated,
      ...(withDelta && impactScope ? {scopeDeltaPp:roasScopeDeltaPp(impactScope.baseline,impactScope.current)} : {}),
      evidenceIds:groups.flatMap(group=>dates.map(id=>group[id].evidenceId)),limitations};
  }
  function metricBreakdown(pack,role,args) {
    const scope=metricScope(pack,role,args);
    if (scope.status !== 'ready') return {...scope,dimension:args.dimension,groups:[],total:0};
    const searchOnly=args.dimension === 'keyword' && isSearchOnly(pack,selectFacts(pack.data,pack.scope.filters));
    if (!scope.supportedDimensions.includes(args.dimension) ||
        !dashboardDimensions(args.metric,searchOnly).includes(args.dimension)) fail('unsupported_scope');
    const groups=metricGroups(pack,role,args,true);
    return {...scope,...groups,limitations:[...scope.limitations,...groups.limitations]};
  }
  function metricDetail(pack,role,args) {
    const scope=metricScope(pack,role,args);
    if (scope.status === 'ready' && args.dimension && !scope.supportedDimensions.includes(args.dimension))
      fail('unsupported_scope');
    const components=metricComponents(pack,role,args,scope);
    if (scope.status !== 'ready' || !args.dimension) return components;
    const groups=metricGroups(pack,role,args);
    return {...components,...groups,evidenceIds:[...components.evidenceIds,...groups.evidenceIds],
      limitations:[...components.limitations,...groups.limitations]};
  }
  function trend(pack,role,args) {
    const periodId = args.periodId ?? 'both';
    const chosen = args.metrics ?? Object.keys(metrics);
    const facts = selectFacts(pack.data,pack.scope.filters);
    const datesAvailable = [...new Set(facts.filter(row =>
      periodId === 'both' || row.periodId === periodId).map(row=>row.date))]
      .filter(date => date < pack.data.asOf.slice(0,10)).sort();
    const {offset,limit,nextOffset,truncated} = limits(args,datesAvailable.length);
    const days = datesAvailable.slice(offset,offset+limit).map(date => {
      const rows = facts.filter(row => row.date === date);
      const period = pack.data.periods.find(p=>inPeriod(date,p));
      const totals = summarize(rows);
      const evidenceId = issue(pack,role,'daily','facts',rows,period.id,
        {date,totals,rowCount:rows.length});
      return {date,periodId:period.id,totals,
        components:Object.fromEntries(chosen.map(metric=>[metric,metricResult(rows,metric)])),
        display:Object.fromEntries(chosen.map(metric=>[metric,chatValue(totals.rates[metric] ?? totals[metric] ?? null,metric)])),
        evidenceId,rowCount:rows.length};
    });
    return {...base(role),status:datesAvailable.length?'ready':'empty',granularity:'day',
      days,total:datesAvailable.length,nextOffset,truncated,
      evidenceIds:days.map(day=>day.evidenceId),
      limitations:truncated?['일부 날짜만 반환되었습니다. 누락 날짜를 0으로 채우지 않습니다.']:[]};
  }
  function recordRows(pack) {
    return selectRecords(pack.data,pack.scope.filters).filter(row =>
      row.date <= pack.data.asOf.slice(0,10) &&
      row.date < pack.data.periods.find(p=>p.id==='current').end);
  }
  function records(pack,role,args) {
    const rows = recordRows(pack);
    const categories = [...new Set(rows.map(row=>row.category))].sort();
    if (args.category !== undefined && !categories.includes(args.category)) fail('unsupported_scope');
    const query = searchQuery(args.query);
    const found = rows.filter(row => (args.category === undefined || row.category === args.category) &&
      (!query || JSON.stringify(row).toLocaleLowerCase().includes(query)))
      .toSorted((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    const {offset,limit,nextOffset,truncated} = limits(args,found.length);
    const page = found.slice(offset,offset+limit).map(row => {
      const evidenceId = issue(pack,role,'record','records',[row],null,row);
      return asRecord(row,evidenceId);
    });
    return {...base(role),status:found.length?'ready':'empty',records:page,
      categories,total:found.length,nextOffset,truncated,
      evidenceIds:page.map(row=>row.evidenceId),
      limitations:['운영 변경과 성과 변화의 시간적 근접은 인과 관계의 증거가 아닙니다.']};
  }
  function reviewRows(pack,args) {
    if (!['S16','S17'].includes(pack.data.caseId) || pack.review.status !== 'ready') return [];
    const sourceId = args.sourceId ?? 'all';
    return pack.review.reviews.filter(row => sourceId === 'all' || row.sourceId === sourceId);
  }
  function reviewStatus(pack,role) {
    const status = pack.review.status;
    return {...base(role),status,
      productId:'EDU-P1',productName:'쓱쓱샴푸',
      caseAvailability:status === 'not_provided' ? 'not_provided' : status === 'ready' ? 'provided' : status,
      classificationStatus:pack.review.classificationStatus ?? status,
      taxonomyVersion:pack.review.classificationVersion ?? null,
      asOf:pack.data.asOf,
      limitations: status === 'not_provided' ? ['이 사례는 리뷰 자료 제공 대상이 아닙니다. 0건으로 해석하지 않습니다.'] :
        status === 'pending' ? ['리뷰 분류 검수가 완료되지 않았습니다.'] :
        status === 'error' ? ['리뷰 데이터 무결성을 확인하지 못했습니다. ROAS 조회는 별도로 가능합니다.'] :
        ['리뷰에는 광고 캠페인과 기기 필터를 적용할 원천 연결 키가 없습니다.',
          '리뷰 감성과 카테고리는 고객 경험 관측이며 ROAS 변화의 인과 증거가 아닙니다.']};
  }
  function validateReviewFilters(pack,args) {
    if (args.categoryId !== undefined && !pack.review.periods?.some(p=>
        p.categories?.some(c=>c.categoryId===args.categoryId))) fail('unsupported_scope');
    if (args.experienceId !== undefined && !pack.review.periods?.some(p=>
        p.experiences?.some(e=>e.experienceId===args.experienceId))) fail('unsupported_scope');
    if (args.sentiment !== undefined && !['positive','negative','neutral','mixed'].includes(args.sentiment))
      fail('unsupported_scope');
  }
  function reviewSummary(pack,role,args) {
    const output = reviewStatus(pack,role);
    if (output.status !== 'ready') return {...output,periods:[],sources:[]};
    validateReviewFilters(pack,args);
    const rows = reviewRows(pack,args);
    const periods = pickPeriods(pack,args.periodId).map(period => {
      const selected = rows.filter(row=>inPeriod(row.writtenAt.slice(0,10),period));
      const evidenceId = issue(pack,role,'review_summary','reviews',selected,period.id,
        {count:selected.length,meanRating:selected.length ? selected.reduce((v,r)=>v+r.rating,0)/selected.length : null});
      const definitions = pack.review.periods.find(item=>item.id===period.id);
      const categories = definitions.categories.filter(item =>
        args.categoryId === undefined || item.categoryId === args.categoryId).map(item => {
        const matched = selected.filter(row=>row.categories.includes(item.categoryId));
        const categoryEvidenceId = issue(pack,role,'review_category','reviews',matched,period.id,
          {categoryId:item.categoryId,count:matched.length,denominator:selected.length});
        return {categoryId:item.categoryId,count:matched.length,
          percent:selected.length ? matched.length/selected.length*100:null,
          evidenceIds:[categoryEvidenceId]};
      });
      const experiences = definitions.experiences.filter(item =>
        args.categoryId === undefined || item.categoryId === args.categoryId).map(item => ({
        experienceId:item.experienceId,categoryId:item.categoryId,
        count:selected.filter(row=>row.experiences.some(a=>a.experienceId===item.experienceId)).length,
        evidenceIds:[evidenceId],
      }));
      return {...clone(period),count:selected.length,
        meanRating:selected.length ? selected.reduce((sum,row)=>sum+row.rating,0)/selected.length : null,
        categories,experiences,unclassifiedCount:selected.filter(row=>row.classification==='unclassified').length,
        evidenceId};
    });
    const validPeriodIds = new Set(pickPeriods(pack,args.periodId).map(period=>period.id));
    const sourcesResult = sources.slice(1).map(sourceId=>({
      sourceId,count:rows.filter(row=>row.sourceId===sourceId &&
        validPeriodIds.has(pack.data.periods.find(p=>inPeriod(row.writtenAt.slice(0,10),p))?.id)).length,
    }));
    output.status=periods.some(period=>period.count)?'ready':'empty';
    return {...output,periods,sources:sourcesResult,
      evidenceIds:[...new Set(periods.flatMap(period=>[period.evidenceId,
        ...period.categories.flatMap(c=>c.evidenceIds),
        ...period.experiences.flatMap(e=>e.evidenceIds)]))]};
  }
  function reviewRecords(pack,role,args) {
    const output = reviewStatus(pack,role);
    if (output.status !== 'ready') return {...output,reviews:[],total:null,nextOffset:null,truncated:false};
    validateReviewFilters(pack,args);
    if (args.reviewIds !== undefined && (!Array.isArray(args.reviewIds) ||
        !args.reviewIds.length || args.reviewIds.length > 24 ||
        new Set(args.reviewIds).size !== args.reviewIds.length ||
        args.reviewIds.some(id=>typeof id !== 'string' || !pack.reviewsById.has(id)))) fail('unsupported_scope');
    const query=searchQuery(args.query);
    const rows=reviewRows(pack,args).filter(row =>
      (args.periodId === undefined || args.periodId === 'both' ||
        inPeriod(row.writtenAt.slice(0,10),pack.data.periods.find(p=>p.id===args.periodId))) &&
      (args.reviewIds === undefined || args.reviewIds.includes(row.id)) &&
      (args.categoryId === undefined || row.categories.includes(args.categoryId)) &&
      (args.experienceId === undefined && args.sentiment === undefined || row.experiences.some(a=>
        (args.categoryId === undefined || a.categoryId===args.categoryId) &&
        (args.experienceId === undefined || a.experienceId===args.experienceId) &&
        (args.sentiment === undefined || a.sentiment===args.sentiment))) &&
      (!query || (row.text + ' ' + row.id).toLocaleLowerCase().includes(query)));
    const {offset,limit,nextOffset,truncated}=limits(args,rows.length);
    const reviews=rows.slice(offset,offset+limit).map(row=>{
      const period=pack.data.periods.find(p=>inPeriod(row.writtenAt.slice(0,10),p));
      const evidenceId=issue(pack,role,'review_record','reviews',[row],period.id,row);
      return {evidenceId,reviewId:row.id,sourceId:row.sourceId,sourceName:row.sourceName,
        writtenAt:row.writtenAt,collectedAt:row.collectedAt,rating:row.rating,text:row.text,
        classification:row.classification,assignments:clone(row.experiences)};
    });
    return {...output,status:rows.length?'ready':'empty',reviews,total:rows.length,
      nextOffset,truncated,evidenceIds:reviews.map(row=>row.evidenceId)};
  }
  async function execute({name,args}={}) {
    try {
      validate(name,args);
      if (name === 'evidence') {
        const items=evidenceItems(args.evidenceIds);
        const found=new Set(items.map(item=>item.evidenceId));
        return {...base(),status:items.length?'ready':'empty',items,
          missing:args.evidenceIds.filter(id=>!found.has(id)),evidenceIds:items.map(item=>item.evidenceId)};
      }
      const pack=getPack(args.scopeRole), role=args.scopeRole;
      const actions={overview,metric_detail:metricDetail,metric_components:metricComponents,metric_breakdown:metricBreakdown,trend,records,
        review_summary:reviewSummary,review_records:reviewRecords};
      return clone(actions[name](pack,role,args));
    } catch (error) {
      const response=!disposed && snapshots.has('primary') ? meta(snapshots.get('primary'),'primary') :
        {scope:null, reportingBasis:null,dataHash:null,sourceVersion:null,evidenceIds:[],limitations:[]};
      return {...response,status:'error',errorCode:error.code ?? 'tool_failed',
        limitations:['요청한 자료를 조회할 수 없습니다.']};
    }
  }
  function optionCatalog() {
    const pack=getPack('primary');
    const facts=selectFacts(pack.data,pack.scope.filters);
    const unique=(items,key)=>[...new Map(items.map(item=>[item[key],item])).values()];
    const periods=pack.review.status==='ready'?pack.review.periods:[];
    return {
      recordCategories:[...new Set(recordRows(pack).map(row=>row.category))],
      searchOnly:isSearchOnly(pack,facts),
      reviewStatus:pack.review.status,
      reviewSources:unique(reviewRows(pack,{}).map(({sourceId,sourceName})=>({sourceId,sourceName})),'sourceId'),
      reviewCategories:unique(periods.flatMap(period=>period.categories||[]),'categoryId'),
      reviewExperiences:unique(periods.flatMap(period=>period.experiences||[]),'experienceId'),
      reviewIds:reviewRows(pack,{}).map(row=>row.id)
    };
  }
  return Object.freeze({metricCatalog,toolSchemas,optionCatalog,execute,evidenceItems,
    async dispose() {if (disposed) return;disposed=true;issued.clear();snapshots.clear();}});
}
