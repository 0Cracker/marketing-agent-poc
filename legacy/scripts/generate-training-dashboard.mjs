import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadCurrentData, dataDirectory, sha256} from './current-data.mjs';
import {trainingCaseIds, trainingMeasures, summarize, trainingCostDefinition} from '../shared/training-dashboard.mjs';
import {buildMixedCase} from './training-mixed.mjs';

const periods = [{id: 'baseline', start: '2026-08-03', end: '2026-08-17'}, {id: 'current', start: '2026-08-17', end: '2026-08-31'}];
const initialAsOf = '2026-08-31T00:00:00+09:00';
const matureAsOf = '2026-09-07T00:00:00+09:00';
const devices = ['mobile', 'desktop'];
const campaignSpecs = [
  ['구글 검색 A', 'search', 'google', 'Google Ads', 'search_ads', 'ad_impression'],
  ['구글 검색 B', 'search', 'google', 'Google Ads', 'search_ads', 'ad_impression'],
  ['페이스북 피드', 'social', 'facebook', 'Meta Ads', 'feed_ads', 'ad_impression'],
  ['인스타그램 피드', 'social', 'instagram', 'Meta Ads', 'feed_ads', 'ad_impression'],
  ['네이버 블로그 제휴', 'content', 'naver_blog', '가상 클릭당 정산 제휴', 'blog_affiliate', 'content_view'],
  ['인스타그램 제휴', 'content', 'instagram', '가상 클릭당 정산 제휴', 'creator_affiliate', 'content_view'],
];

// Largest-remainder allocation preserves integer totals without manufacturing individual users or orders.
export function allocate(total, weights) {
  assert(Number.isSafeInteger(total) && total >= 0);
  const denominator = weights.reduce((sum, value) => sum + value, 0);
  if (!denominator) {assert.equal(total, 0); return weights.map(() => 0);}
  const exact = weights.map(value => total * value / denominator);
  const result = exact.map(Math.floor);
  const order = exact.map((value, index) => ({index, remainder: value - result[index]})).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remaining = total - result.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < remaining; index++) result[order[index].index]++;
  assert.equal(result.reduce((sum, value) => sum + value, 0), total);
  return result;
}
function above(total, minima, weights) {
  const floor = minima.reduce((sum, value) => sum + value, 0);
  assert(total >= floor, `counter_below_children:${total}<${floor}`);
  return allocate(total - floor, weights).map((value, index) => value + minima[index]);
}
function capped(total, caps) {
  assert(total <= caps.reduce((sum, value) => sum + value, 0));
  const result = allocate(total, caps);
  assert(result.every((value, index) => value <= caps[index]));
  return result;
}
const dayAt = (start, offset) => new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const makeRow = (id, date, periodId, campaignId, device, exposureBasis) => ({id, date, periodId, campaignId, device, exposureBasis, ...Object.fromEntries(trainingMeasures.map(key => [key, 0]))});

function productsFor(orders, caseId, current) {
  if (current && caseId === 'S03') return [orders * .7, orders * .2, orders * .1].map(Math.round);
  const side = Math.floor(orders * .3);
  return [side, orders - side * 2, side];
}
function deviceProductSplit(counts, target) {
  if (counts[0] === counts[2]) {
    const side = Math.min(counts[0], Math.floor(target / 2), Math.max(Math.ceil((target - counts[1]) / 2), Math.round(counts[0] * .6)));
    const mobile = [side, target - side * 2, side];
    assert(mobile.every((value, index) => value >= 0 && value <= counts[index]));
    return [mobile, counts.map((value, index) => value - mobile[index])];
  }
  const mobile = capped(target, counts);
  return [mobile, counts.map((value, index) => value - mobile[index])];
}

export function buildTrainingData(catalog) {
  // Training merchandise has its own identity; catalog competitor products are not shop revenue.
  const products = [25000, 50000, 75000].map((listPrice, index) => ({id: `EDU-P${index + 1}`, label: `교육용 자사 상품 ${index + 1}`, listPrice, discountRate: .2}));
  const campaigns = campaignSpecs.map(([label, channel, source, platform, adType, exposureBasis], index) => ({id: `EDU-C${index + 1}`, label, channel, source, platform, adType, exposureBasis, dailyBudget: 60000, targetRoas: 3.5, bidStrategy: '수동 집행', landingUrl: `https://shop.example.test/items/${products[index % 3].id}`, advertisedProductId: products[index % 3].id}));
  const sourceAds = catalog.records.filter(row => row.scenario_id === 'R001-roas-decline' && row.dataset_type === 'T13' && row.period.start >= periods[0].start && row.period.start < periods[0].end);
  assert.equal(sourceAds.length, 28);
  const weights = Array.from({length: 14}, (_, index) => sourceAds.filter(row => row.period.start === dayAt(periods[0].start, index)).reduce((sum, row) => sum + row.metrics.clicks, 0));
  const commonRecords = [];
  const record = (category, campaignId, device, productId, date, title, values) => ({id: `EDU-R${commonRecords.length + 1}`, date, category, campaignId, device, productId, title, values});
  const shared = (category, campaignId, productId, title, values) => {const row = record(category, campaignId, 'all', productId, '2026-08-03', title, values); commonRecords.push(row); return row.id;};
  for (const campaign of campaigns) {
    shared('campaign', campaign.id, null, campaign.label, {목적: '결제 완료 구매', 일예산: campaign.dailyBudget, 목표ROAS: 350, 입찰방식: campaign.bidStrategy, 출처: campaign.source, 집행유형: campaign.adType, 관측분모: campaign.exposureBasis === 'ad_impression' ? '매체 보고 광고 노출' : '제공된 콘텐츠 조회', 클릭정의: '전용 링크를 통한 사이트 이동 클릭'});
    if (campaign.channel === 'content') Object.assign(commonRecords.at(-1).values, {비용계약: '클릭당 정산 제휴', 비용범위: trainingCostDefinition, 비용집계일: '클릭 발생일, Asia/Seoul', 정산단가: '일별, 캠페인, 기기별 가상 단가, 비용/클릭으로 확인', 비용배분: '일별 클릭에 따라 발생, 상품과 유입 분할 비용은 교육용 가상 배분'});
    shared('creative', campaign.id, campaign.advertisedProductId, `${campaign.label} 소재 v1`, {소재버전: 'v1', 문구: '상품의 용량, 가격과 배송 조건을 확인하세요.', 형식: campaign.channel === 'search' ? '검색 텍스트' : '이미지와 소개문', 집행시작: '2026-08-03', 랜딩: campaign.landingUrl});
    shared('landing', campaign.id, campaign.advertisedProductId, `${campaign.label} 연결 페이지`, {페이지버전: 'v1', 광고상품: campaign.advertisedProductId, 연결상품: campaign.advertisedProductId, 페이지: campaign.landingUrl, 배송비: 3000, 배송약속: '주문 후 2영업일'});
  }
  for (const product of products) shared('inventory', null, product.id, `${product.label} 판매 상태`, {구매가능: true, 일판매가능시간: 24, 재고수량: 500, 정가: product.listPrice, 할인율: 20});
  shared('tracking', null, null, '구매 수집 설정 v1', {추적버전: 'v1', 수집주기: '매일', 인정기간: '7일', 귀속: '마지막 유료 클릭', 구매정의: '결제 완료', 중복제거: '거래 식별 기준', 오류코드: '없음'});
  shared('change', null, null, '캠페인 공통 초기 설정', {항목: '초기 등록', 적용시각: '2026-08-03T00:00:00+09:00', 변경전: '미등록', 변경후: '구매 목표 집행'});
  shared('incident', null, null, '사이트 운영 점검', {점검시각: '2026-08-03T09:00:00+09:00', 상태: '구매 가능', 결제점검: '통과', 오류코드: '없음'});
  const cases = [], overrides = {}, review = [];
  for (const caseId of trainingCaseIds) {
    if (['S16', 'S17', 'S18'].includes(caseId)) {
      const pack = buildMixedCase(caseId, cases[0], commonRecords, allocate);
      cases.push(pack);
      review.push({caseId, snapshot: 'initial', periods: periods.map(period => ({period: period.id, ...summarize(pack.facts.filter(row => row.periodId === period.id))}))});
      continue;
    }
    for (const mature of caseId === 'S15' ? [false, true] : [false]) {
      const facts = [], breakdowns = [], reach = [];
      const caseCampaigns = structuredClone(campaigns);
      for (const period of periods) for (let c = 0; c < campaigns.length; c++) {
        const current = period.id === 'current', changed = current ? caseId : '';
        const high = c % 2 === 0, baselineOrders = high ? 30 : 10;
        let orders = baselineOrders, clicks = 400, spend = 200000;
        if (changed === 'S01' && [0, 3].includes(c)) spend = 500000;
        if (changed === 'S04') orders *= 1.4;
        if (changed === 'S05') {orders *= .6; clicks *= 2;}
        if (changed === 'S06') {orders = high ? 27 : 1; clicks = high ? 360 : 40; spend = high ? 180000 : 20000;}
        if (changed === 'S07') {orders = 15; clicks = high ? 200 : 600; spend = high ? 100000 : 300000;}
        if (changed === 'S08') {orders *= 1.5; clicks *= 2; spend *= 2;}
        if (changed === 'S09' && c < 4) {orders /= 2; clicks /= 2;}
        if (changed === 'S10') {orders *= 1.2; clicks *= 2; spend *= 2;}
        if (changed === 'S12') orders *= .7;
        const baseProductCounts = productsFor(baselineOrders, '', false);
        const baseDeviceProducts = deviceProductSplit(baseProductCounts, Math.round(baselineOrders * .6));
        let deviceProducts = deviceProductSplit(productsFor(orders, caseId, current), Math.round(orders * .6));
        if (['S02', 'S13'].includes(changed)) deviceProducts = [productsFor(Math.round(baselineOrders * .6) / 3, '', false), baseDeviceProducts[1]];
        if (changed === 'S11') deviceProducts = baseDeviceProducts.map(counts => counts.map((value, index) => index === 1 ? 0 : value));
        if (changed === 'S14') deviceProducts = deviceProductSplit(productsFor(baselineOrders * .6, '', false), Math.round(baselineOrders * .6 * .6));
        if (caseId === 'S15' && current && !mature) deviceProducts = baseDeviceProducts.map(counts => productsFor(Math.round(counts.reduce((a,b)=>a+b,0) * .6), '', false));
        if (changed === 'S06') caseCampaigns[c].dailyBudget = high ? 60000 : 2000;
        if (['S08', 'S10'].includes(changed)) caseCampaigns[c].dailyBudget = 120000;
        for (let d = 0; d < devices.length; d++) {
          const device = devices[d], campaign = campaigns[c], unitPrices = products.map(product => Math.round(product.listPrice * (changed === 'S12' ? 1 : .8)));
          const deviceClicks = allocate(clicks, [.6, .4])[d], deviceSpend = allocate(spend, [.6, .4])[d];
          const productCounts = deviceProducts[d], deviceOrders = productCounts.reduce((sum, value) => sum + value, 0);
          const baseCount = baseDeviceProducts[d].reduce((sum, value) => sum + value, 0);
          const ledgerOrders = changed === 'S14' ? baseCount : deviceOrders;
          const sameSession = caseId === 'S15' ? Math.round(baseCount * .6) : deviceOrders;
          const returnPurchases = caseId === 'S15' ? deviceOrders - sameSession : 0;
          // Different campaigns do not all round their small purchase counts onto the same dates.
          // Keep the offset identical across cases and both periods so it cannot explain the scenario change.
          const purchaseWeights=weights.map((_,index)=>weights[(index+c*2+d)%weights.length]);
          const productDays = productCounts.map(total => allocate(total, purchaseWeights));
          const orderDays = weights.map((_, day) => productDays.reduce((sum, values) => sum + values[day], 0));
          const purchaseDays = capped(sameSession, orderDays);
          const funnelBase = ['S13', 'S14', 'S15'].includes(caseId) ? baseCount : deviceOrders;
          const checkouts = above(funnelBase * 2, purchaseDays, weights);
          const carts = above(funnelBase * 3, checkouts, weights);
          const views = above(Math.max(funnelBase * 3, Math.round(deviceClicks * .54)), carts, weights);
          const sessions = above(Math.max(Math.round(deviceClicks * .6), views.reduce((sum,v)=>sum+v,0)), views, weights);
          const clickDays = above(deviceClicks, sessions, weights);
          const impressionDays = above(allocate(20000, [.6,.4])[d], clickDays, weights);
          const spendDays = allocate(deviceSpend, changed === 'S06' && c === 5 ? clickDays : weights);
          let productSpendDays;
          if (changed === 'S06' && c === 5) {
            const shares = productCounts.some(Boolean) ? productCounts : [.3, .4, .3];
            const remaining = [...spendDays];
            const originalDays = allocate(deviceSpend, weights);
            // Keep SKU period costs as well as daily parent totals after the approved reallocation.
            productSpendDays = shares.map((_, p) => {
              const target = originalDays.reduce((sum, cost) => sum + allocate(cost, shares)[p], 0);
              const values = capped(target, remaining);
              values.forEach((value, day) => remaining[day] -= value);
              return values;
            });
          }
          const ledgerDays = changed === 'S14' ? above(ledgerOrders, orderDays, weights) : orderDays;
          const failures = (c === 0 && d === 0 ? 2 : 0) + (changed === 'S13' ? baseCount - deviceOrders : 0);
          const failureDays = allocate(failures, checkouts);
          const campaignFacts = [];
          for (let day = 0; day < 14; day++) {
            const date = dayAt(period.start, day), row = makeRow(`${caseId}-${period.id}-${c}-${d}-${day}`, date, period.id, campaign.id, device, campaign.exposureBasis);
            Object.assign(row, {impressions: impressionDays[day], clicks: clickDays[day], spend: spendDays[day], sessions: sessions[day], view: views[day], cart: carts[day], checkout: checkouts[day], purchases: purchaseDays[day], returnPurchases: orderDays[day] - purchaseDays[day], orders: orderDays[day], units: orderDays[day], ledgerOrders: ledgerDays[day], paymentAttempts: ledgerDays[day] + failureDays[day], paymentFailures: failureDays[day], loadSamples: sessions[day], loadTotalMs: sessions[day] * (device === 'mobile' ? 1400 : 900), trackingExpected: ledgerDays[day], trackingReceived: orderDays[day]});
            row.ledgerRevenue = changed === 'S14' ? ledgerDays[day] * 40000 : 0;
            const skuRows = products.map((product, p) => ({...row, id: `${row.id}-product-${p}`, dimension: 'product', key: product.id, label: product.label, source: campaign.source, creativeId: `${campaign.id}-v1`, audienceId: 'all', placement: 'all', keyword: '', matchType: '', browser: device === 'mobile' ? '모바일 브라우저' : 'PC 브라우저', paymentMethod: device === 'mobile' ? '간편결제' : '카드', orders: productDays[p][day], units: productDays[p][day], listRevenue: productDays[p][day] * product.listPrice, revenue: productDays[p][day] * unitPrices[p]}));
            const shares = productCounts.some(Boolean) ? productCounts : [.3,.4,.3];
            const upstreamShares = changed === 'S11' ? baseDeviceProducts[d] : shares;
            const purchased = capped(row.purchases, skuRows.map(item => item.orders));
            for (let p = 0; p < 3; p++) {skuRows[p].purchases = purchased[p]; skuRows[p].returnPurchases = skuRows[p].orders - purchased[p]; skuRows[p].discount = skuRows[p].listRevenue - skuRows[p].revenue;}
            for (const key of ['checkout','cart','view','sessions','clicks','impressions']) {
              const child = {checkout:'purchases',cart:'checkout',view:'cart',sessions:'view',clicks:'sessions',impressions:'clicks'}[key];
              const parts = above(row[key], skuRows.map(item => item[child]), ['view','sessions','clicks','impressions'].includes(key) ? upstreamShares : shares);
              skuRows.forEach((item, p) => item[key] = parts[p]);
            }
            for (const key of ['spend','ledgerOrders','paymentAttempts','paymentFailures','redirectErrors','loadTotalMs','loadSamples','trackingExpected','trackingReceived','duplicateEvents']) {
              const parts = key === 'spend' && productSpendDays ? productSpendDays.map(values => values[day]) : allocate(row[key], upstreamShares); skuRows.forEach((item,p)=>item[key]=parts[p]);
            }
            const skuFailures=allocate(row.paymentFailures,skuRows.map(item=>item.checkout));skuRows.forEach((item,p)=>item.paymentFailures=skuFailures[p]);
            for (const key of ['listRevenue','discount','revenue']) row[key] = skuRows.reduce((sum,item)=>sum+item[key],0);
            if (changed !== 'S14') row.ledgerRevenue = row.revenue;
            const ledgerExtra = productsFor(row.ledgerOrders-row.orders,'',false);
            skuRows.forEach((item,p)=>{item.ledgerOrders=item.orders+ledgerExtra[p];item.ledgerRevenue=item.revenue+ledgerExtra[p]*unitPrices[p];item.trackingExpected=item.ledgerOrders;item.trackingReceived=item.orders;item.paymentAttempts=item.ledgerOrders+item.paymentFailures;item.loadSamples=item.sessions;item.loadTotalMs=item.sessions*(device==='mobile'?1400:900);});
            facts.push(row); campaignFacts.push(row); breakdowns.push(...skuRows);
          }
          const targetCore = Math.round(deviceOrders * (changed === 'S10' ? 5/6 : .5));
          const trafficOrders = capped(targetCore, campaignFacts.map(row=>row.orders));
          const campaignTraffic=[];
          for (let day = 0; day < 14; day++) {
            const row = campaignFacts[day], parts = [trafficOrders[day],row.orders-trafficOrders[day]];
            const trafficRows = parts.map((value,index)=>({...row,id:`${row.id}-traffic-${index}`,dimension:'traffic',key:index?'extended':'core',label:index?'확장 집단':'핵심 집단',source:campaign.source,creativeId:`${campaign.id}-v${changed==='S05'?2:1}`,audienceId:index?'extended':'core',placement:campaign.channel==='search'?'검색 결과':campaign.channel==='social'?(device==='mobile'?'모바일 피드':'PC 피드'):'콘텐츠 본문',keyword:campaign.channel==='search'?(index?'생활용품 추천':'제품 구매'):'',matchType:campaign.channel==='search'?(index?'구문':'일치'):'',browser:device==='mobile'?'모바일 브라우저':'PC 브라우저',paymentMethod:device==='mobile'?'간편결제':'카드',orders:value,units:value}));
            const pparts = capped(row.purchases,parts); trafficRows.forEach((item,index)=>{item.purchases=pparts[index];item.returnPurchases=item.orders-item.purchases;});
            for (const key of ['checkout','cart','view','sessions','clicks','impressions']) {
              const child={checkout:'purchases',cart:'checkout',view:'cart',sessions:'view',clicks:'sessions',impressions:'clicks'}[key];
              const values=above(row[key],trafficRows.map(item=>item[child]),[1,1]); trafficRows.forEach((item,index)=>item[key]=values[index]);
            }
            for (const key of trainingMeasures.filter(key=>!['orders','units','purchases','returnPurchases','checkout','cart','view','sessions','clicks','impressions'].includes(key))) {
              const values=allocate(row[key],['revenue','listRevenue','discount'].includes(key)&&parts.some(Boolean)?parts:[1,1]);trafficRows.forEach((item,index)=>item[key]=values[index]);
            }
            const trafficExtra = allocate(row.ledgerOrders-row.orders,[1,1]);
            trafficRows.forEach((item,index)=>{item.ledgerOrders=item.orders+trafficExtra[index];item.ledgerRevenue=item.revenue+trafficExtra[index]*40000;item.trackingExpected=item.ledgerOrders;item.trackingReceived=item.orders;item.paymentAttempts=item.ledgerOrders+item.paymentFailures;item.loadSamples=item.sessions;item.loadTotalMs=item.sessions*(device==='mobile'?1400:900);});
            campaignTraffic.push(trafficRows);
          }
          // Preserve each audience's exact period denominator, rather than rounding every day's half independently.
          for(const key of ['checkout','cart','view','sessions','clicks','impressions']) {
            const child={checkout:'purchases',cart:'checkout',view:'cart',sessions:'view',clicks:'sessions',impressions:'clicks'}[key];
            const minima=campaignTraffic.map(pair=>pair[0][child]);
            const caps=campaignTraffic.map((pair,index)=>campaignFacts[index][key]-pair[1][child]-minima[index]);
            const target=Math.round(campaignFacts.reduce((sum,row)=>sum+row[key],0)/2);
            const extra=capped(target-minima.reduce((sum,value)=>sum+value,0),caps);
            campaignTraffic.forEach((pair,index)=>{pair[0][key]=minima[index]+extra[index];pair[1][key]=campaignFacts[index][key]-pair[0][key];});
          }
          if (changed === 'S06' && c === 5) {
            // Preserve the existing audience period costs while charging only dates with clicks.
            const originalCoreCost = allocate(deviceSpend, weights).reduce((sum, cost) => sum + Math.ceil(cost / 2), 0);
            const coreCosts = capped(originalCoreCost, spendDays);
            campaignTraffic.forEach((pair, day) => {pair[0].spend = coreCosts[day]; pair[1].spend = spendDays[day] - coreCosts[day];});
          }
          for(const pair of campaignTraffic)for(const item of pair){item.loadSamples=item.sessions;item.loadTotalMs=item.sessions*(device==='mobile'?1400:900);breakdowns.push(item);}
          const impressions = campaignFacts.reduce((sum,row)=>sum+row.impressions,0);
          reach.push({periodId:period.id,campaignId:campaign.id,device,impressions,reach:campaign.exposureBasis==='ad_impression'?Math.round(impressions/(changed==='S09'&&c<4?4:2)):null});
          assert.equal(returnPurchases,campaignFacts.reduce((sum,row)=>sum+row.returnPurchases,0));
        }
      }
      const recordIds = commonRecords.filter(row=>!row.id.startsWith('CASE-')).map(row=>row.id);
      const add = (category,campaignId,device,productId,title,values) => {const row={id:`CASE-${caseId}-${commonRecords.filter(r=>r.id.startsWith(`CASE-${caseId}-`)).length+1}`,date:'2026-08-17',category,campaignId,device,productId,title,values};commonRecords.push(row);recordIds.push(row.id);};
      if (!mature) {
        if(caseId==='S02') for(const campaign of campaigns) add('landing',campaign.id,'mobile',campaign.advertisedProductId,'모바일 연결 설정',{페이지버전:'v2',광고상품:campaign.advertisedProductId,연결상품:products[(products.findIndex(product=>product.id===campaign.advertisedProductId)+1)%3].id,적용시각:'2026-08-17T00:00:00+09:00',페이지:`https://shop.example.test/items/${products[(products.findIndex(product=>product.id===campaign.advertisedProductId)+1)%3].id}`});
        if(caseId==='S05') for(const campaign of campaigns) add('creative',campaign.id,'all',campaign.advertisedProductId,`${campaign.label} 소재 v2`,{소재버전:'v2',문구:'배송비 없이 지금 상품을 확인하세요.',실제배송비:3000,집행시작:'2026-08-17'});
        if(['S06','S07','S08'].includes(caseId)) for(let c=0;c<6;c++) {if(caseId==='S06'&&caseCampaigns[c].dailyBudget===60000)continue;add('change',campaigns[c].id,'all',null,`${campaigns[c].label} 집행 설정`,{항목:caseId==='S07'?'기간 집행 배분':'일예산',변경전:caseId==='S07'?200000:60000,변경후:caseId==='S07'?(c%2?300000:100000):caseCampaigns[c].dailyBudget,적용시각:'2026-08-17T00:00:00+09:00'});}
        if(caseId==='S09') for(let c=0;c<4;c++) add('campaign',campaigns[c].id,'all',null,`${campaigns[c].label} 도달 설정`,{타깃정의:'기존 집단 유지',지면정의:'기존 지면 유지',소재버전:'v1',조회범위:'2026-08-17~2026-08-30'});
        if(caseId==='S10') for(const campaign of campaigns) add('change',campaign.id,'all',null,`${campaign.label} 타깃 설정`,{항목:'확장 집단',변경전:'기존 관심 집단',변경후:'넓은 관심 집단 포함',적용시각:'2026-08-17T00:00:00+09:00'});
        if(caseId==='S11') add('inventory',null,'all',products[1].id,`${products[1].label} 판매 상태`,{구매가능:false,일판매가능시간:0,재고수량:0,적용시각:'2026-08-17T00:00:00+09:00'});
        if(caseId==='S12') for(const product of products) add('change',null,'all',product.id,`${product.label} 판매 조건`,{항목:'할인율',변경전:20,변경후:0,정가:product.listPrice,적용시각:'2026-08-17T00:00:00+09:00'});
        if(caseId==='S13') add('incident',null,'mobile',null,'간편결제 처리 기록',{시작:'2026-08-17T00:00:00+09:00',종료:'2026-08-31T00:00:00+09:00',발생형태:'간헐적',결제수단:'간편결제',오류코드:'PAYMENT_CALLBACK_TIMEOUT',브라우저:'모바일 브라우저'});
        if(caseId==='S14') add('tracking',null,'all',null,'구매 수집 설정 v2',{추적버전:'v2',적용시각:'2026-08-17T00:00:00+09:00',오류코드:'PURCHASE_PAYLOAD_REJECTED',영향:'구매 이벤트 일부',원장수집:'정상'});
        if(caseId==='S15') add('campaign',null,'all',null,'구매 보고 기준',{인정기간:'7일',기준일:'광고 접점일',주문일:'별도 보관',수집주기:'매일'});
      } else recordIds.push(...cases.find(item=>item.caseId===caseId).recordIds.filter(id=>id.startsWith('CASE-')));
      const pack={contract:'roas-training/1',caseId,label:`사례 ${caseId.slice(1)}`,asOf:mature?matureAsOf:initialAsOf,periods,campaigns:caseCampaigns,products,facts,breakdowns,reach,recordIds};
      if(mature) overrides[caseId]=pack; else cases.push(pack);
      review.push({caseId,snapshot:mature?'mature':'initial',periods:periods.map(period=>({period:period.id,...summarize(facts.filter(row=>row.periodId===period.id))}))});
    }
  }
  const payload={contract:'roas-training/1',source:'R001 existing click weekday pattern; independent training-only shop products EDU-P1..3; synthetic aggregate values; paid ads and click-settled content affiliate fees',sourceRecordIds:sourceAds.map(row=>row.record_id),cases,matureOverrides:overrides,records:commonRecords};
  assert(commonRecords.length<=200);
  assert(cases.reduce((sum,item)=>sum+item.facts.length+item.breakdowns.length+item.reach.length,0)+Object.values(overrides).reduce((sum,item)=>sum+item.facts.length+item.breakdowns.length+item.reach.length,0)<50000);
  return {payload,review};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const {catalog,manifest}=loadCurrentData();
  const {payload,review}=buildTrainingData(catalog);
  if(process.argv.includes('--write')) {
    const evidence=path.resolve(dataDirectory,'../evidence/roas-examples-20261027');fs.mkdirSync(evidence,{recursive:true});
    const baselinePath=path.join(evidence,'baseline.json');
    if(!fs.existsSync(baselinePath)) fs.writeFileSync(baselinePath,JSON.stringify({rows:manifest.rows,dataHash:manifest.data_sha256,files:[...manifest.files,...manifest.metadata].filter(file=>file.file!=='training-dashboard.json').map(file=>({file:file.file,sha256:sha256(fs.readFileSync(path.join(dataDirectory,file.file)))}))},null,2)+'\n',{flag:'wx'});
    const encoded=JSON.stringify(payload)+'\n';fs.writeFileSync(path.join(dataDirectory,'training-dashboard.json'),encoded);
    manifest.metadata=manifest.metadata.filter(file=>file.file!=='training-dashboard.json');
    manifest.metadata.push({file:'training-dashboard.json',bytes:Buffer.byteLength(encoded),sha256:sha256(encoded),public:false,contract:'roas-training/1'});
    manifest.data_sha256=sha256(JSON.stringify({contract:manifest.contract,screen_contract:manifest.screen_contract,schema_sha256:manifest.schema_sha256,source_created_at:manifest.source_created_at,scope_ids:manifest.scope_ids,period:manifest.period,files:manifest.files.map(({file,sha256})=>({file,sha256})),metadata:manifest.metadata}));
    fs.writeFileSync(path.join(dataDirectory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    fs.writeFileSync(path.join(evidence,'arithmetic-review.json'),JSON.stringify(review,null,2)+'\n');
  }
  console.log(JSON.stringify({cases:payload.cases.length,records:payload.records.length,facts:payload.cases.reduce((n,c)=>n+c.facts.length,0),breakdowns:payload.cases.reduce((n,c)=>n+c.breakdowns.length,0),written:process.argv.includes('--write')}));
}
