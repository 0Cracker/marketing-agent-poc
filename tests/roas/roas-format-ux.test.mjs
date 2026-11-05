import test from 'node:test';
import assert from 'node:assert/strict';
import {metricDigits,formatMetricValue,formatMetricDelta,formatMetricAbsoluteDelta,formatComparedMetricDelta} from '../../frontend/roas/training-format.ts';

test('ROAS and purchase rate use different display precision without changing raw values',()=>{
 assert.equal(metricDigits('roas',true),1);
 assert.equal(metricDigits('cvr',true),2);
 assert.equal(formatMetricValue(2.84712,'roas',true),'284.7%');
 assert.equal(formatMetricValue(0.0204,'adCtr',true),'2.04%');
 assert.equal(formatMetricValue(0.0416,'cvr',true),'4.16%');
 assert.equal(formatMetricDelta(-0.0073,'cvr',true),'-0.73%p');
 assert.equal(formatMetricDelta(-0.711,'roas',true),'-71.1%p');
});
test('currency is rounded only at display and small changes do not falsely say zero',()=>{
 assert.equal(formatMetricValue(14346.7,'cpa',false,'원'),'14,347원');
 assert.equal(formatMetricAbsoluteDelta(1069.6,'cpa',false,'원'),'+1,070원');
 assert.equal(formatMetricDelta(12.14,'cpa',false),'+12.1%');
 assert.equal(formatMetricDelta(0.000004,'cvr',true),'≈0%p');
 assert.equal(formatMetricValue(null,'cpc',false,'원'),'—');
 assert.equal(formatMetricValue(0,'cpc',false,'원'),'0원');
});

test('table and KPI comparisons share the same percentage scaling',()=>{
 assert.equal(formatComparedMetricDelta(531.9,596.3,'cpc'),'+12.1%');
 assert.equal(formatComparedMetricDelta(0.0489,0.0416,'cvr',true),'-0.73%p');
 assert.equal(formatComparedMetricDelta(0.02,0.02,'adCtr',true),'0%p');
 assert.equal(formatComparedMetricDelta(0,100,'cpc'),'기준값 0');
 assert.equal(formatComparedMetricDelta(null,100,'cpc'),'비교 불가');
});
