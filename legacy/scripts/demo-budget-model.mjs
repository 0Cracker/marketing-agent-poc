import assert from 'node:assert/strict';

export const hillReference='https://developers.google.com/meridian/docs/advanced-modeling/media-saturation-lagging';

// Deterministic CURRENT projection only; callers preserve historical source files.
export function applyDemoBudgetModels(records){
  const totals={KR:15000000,JP:1500000,US:15000};
  const campaigns=new Map(records.filter(r=>r.dataset_type==='T12').map(r=>[r.campaign_id,r]));
  return records.map(record=>{
    if(record.dataset_type!=='T39'||!['response_model','budget_scenario'].includes(record.record_kind))return record;
    const country=record.scope_id.split('-')[1],total=totals[country];
    assert(total,'Unsupported demo model country');
    if(record.record_kind==='budget_scenario'){
      const grouped={search:0,social:0};
      for(const allocation of record.allocations){const channel=campaigns.get(allocation.campaign_ref)?.channel;assert(Object.hasOwn(grouped,channel),'Unsupported scenario channel');grouped[channel]+=Number(allocation.amount.amount);}
      const expected=Number((60*grouped.search/(total/5+grouped.search)+40*grouped.social/(total/10+grouped.social)).toFixed(6));
      return {...record,model_version:'Hill-slope1-demo-20261020',expected_measures:record.expected_measures.map(m=>m.metric_id.endsWith('.expected_conversions')?{...m,value:expected}:m),
        assumptions:['CURRENT Hill slope=1 가상 채널 합산 모형으로 재계산한 시연값이며, 학습된 실제 성과 예측이 아니다.',hillReference]};
    }
    return {...record,model_version:'Hill-slope1-demo-20261020',formula:'scale * budget / (saturation + budget)',
      parameters:[{name:'search.scale',value:'60'},{name:'search.saturation',value:String(total/5)},{name:'social.scale',value:'40'},{name:'social.saturation',value:String(total/10)}],
      assumptions:[
        'Hill slope=1: response = scale × channel_budget / (half_saturation + channel_budget).',
        '한 국가·한 시나리오 기간의 같은 채널 캠페인 예산을 합산한 뒤 채널 반응을 더한다. 검색 최대 60건·소셜 최대 40건은 가상의 모의 전환수다.',
        `가상 계수: 검색 반포화 ${total/5}, 소셜 반포화 ${total/10}; 해당 국가 예산 통화 단위. 총예산 ${total} 기준으로 시연용 설정했다.`,
        '인터넷 근거는 포화 함수의 형태만 뒷받침한다. 계수는 학습·추정되지 않았으며 실제 성과 예측·인과 효과·최적 배분을 입증하지 않는다. Adstock·지연 효과는 적용하지 않는다.',
        '기존 global scale/saturation 모형은 이력 호환을 위해 캠페인별 계산을 유지한다. 채널 계수 모형과 의미가 다르므로 같은 결과로 비교하지 않는다.',
        hillReference
      ]};
  });
}
