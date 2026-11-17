import test from 'node:test';
import assert from 'node:assert/strict';
import {worstStage} from '../../frontend/roas/training-funnel.ts';
import {trainingScreenData} from '../../scripts/roas/training-data.mjs';
import {comparePeriods} from '../../shared/roas/training-dashboard.mjs';

const filters={channel:'all',source:'all',campaignId:'all',device:'all'};

test('worst stage is the largest step-rate drop, ignoring gains and missing rates',()=>{
 assert.equal(worstStage([null,[0.5,0.5],[0.2,0.18],[0.6,0.5],[0.4,0.45]]),3);
 assert.equal(worstStage([null,[0.5,0.6],[null,0.1]]),undefined);
});

test('S16 funnel marks checkout to purchase as the most deteriorated step',()=>{
 const [before,after]=comparePeriods(trainingScreenData(undefined,'S16','initial'),filters);
 const b=before.total,a=after.total;
 const pairs:[number,number][]=[[b.view/b.sessions,a.view/a.sessions],[b.cart/b.view,a.cart/a.view],[b.checkout/b.cart,a.checkout/a.cart],[b.purchases/b.checkout,a.purchases/a.checkout]];
 assert.equal(worstStage([null,...pairs]),4);
 assert(Math.abs((pairs[3][1]-pairs[3][0])*100-(-3.3))<0.1,'결제 시작→구매 약 -3.3%p');
});
