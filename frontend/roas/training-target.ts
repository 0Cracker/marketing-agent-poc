import {selectFacts} from '../../shared/roas/training-dashboard.mjs';
import type {Filters,TrainingData} from '../../shared/roas/training-dashboard.mjs';

// Existing virtual target ROAS (docs/design/roas-training-dashboard.md, 실행 조건).
// Shown only when every campaign in scope shares one target; mixed targets are not averaged.
export function scopeTargetRoas(data:TrainingData,filters:Filters):number|null{
 const ids=new Set(selectFacts(data,filters).map(row=>row.campaignId));
 const targets=new Set(data.campaigns.filter(campaign=>ids.has(campaign.id)).map(campaign=>(campaign as {targetRoas?:number}).targetRoas).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0));
 return targets.size===1?[...targets][0]:null;
}
