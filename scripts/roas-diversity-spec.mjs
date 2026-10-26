import {createHash} from 'node:crypto';

// These are approved simulation assumptions, not estimated marketing benchmarks.
export const spec = {
  seed:'approved-roas-diversity-20261022-1', max_records:12000,
  start:'2026-08-03', end:'2026-08-31', product:'P1A', currency:'KRW',
  default_as_of:'2026-09-15T00:00:00+09:00', generated_at:'2026-10-22T00:00:00+09:00',
  daily_paid_sessions:{min:8,max:20}, device_values:['mobile','desktop'],
  funnel_probabilities:{view:0.93,cart_mobile:0.42,cart_desktop:0.5,checkout:0.72,purchase:0.24},
  consent_values:['granted','denied','unknown'], quantities:[1,2,3],
  purchase_delay_days:[0,1,2,3], minimum_repeat_paid_touch_days:8,
  revenue_basis:'discounted_product_ex_tax_shipping', adjustment_links:'financial_representative',
  cases:[
    {id:'R002',scenario_id:'R002-cost-change',focus:'cost',after_cpc:{search:1.8,social:1.55},after_ctr:0.62,after_quantity:1,after_discount:0,after_adjustment:0.09},
    {id:'R003',scenario_id:'R003-order-value',focus:'revenue',after_cpc:{search:1,social:1.02},after_ctr:1,after_quantity:0.5,after_discount:0.2,after_adjustment:0.09},
    {id:'R004',scenario_id:'R004-adjustment-change',focus:'refund',after_cpc:{search:1.01,social:1},after_ctr:1,after_quantity:1,after_discount:0,after_adjustment:0.66},
  ],
  assumptions:[
    'Independent seeded streams separate traffic, device, consent, funnel, order money, delays, media reports, feedback and adjustments.',
    'Visit time is a simulated 70 percent daytime/evening and 30 percent all-day mixture; each device report contains at least its declared paid visits as clicks.',
    'Each sampled paid landing is assumed to follow one distinct paid click; reports also contain additional clicks without sampled landings. Click IDs and persistent user IDs are not collected for denied or unknown consent.',
    'For denied or unknown consent, the declared order-to-session acquisition reference is a synthetic first-party workflow relation, never an inferred cross-session or cross-device identity join.',
    'Only the declared paid sample and its directly linked return visits are generated; no independent organic population.',
    'A repeat paid touch uses the same consenting pseudonym after at least eight days; delayed returns happen within three days and create no new paid touch.',
    'Purchasing paths contain page view, item view, cart, checkout and purchase in chronological order, possibly across a linked direct return session.',
    'Attributed conversions and product revenue follow last paid touch within seven days, on paid-touch date. Reports are final synthetic ledgers.',
    'One order contains one product line with one to three units. Prices, discounts, timings, financial reasons and feedback are simulated assumptions.',
    'Feedback uses a documented combinatorial template library with neutral, positive and adverse topics; it is not observed customer language or causal proof.',
    'No payment failure logs, actual page versions, audience histories or external operational facts are invented.',
  ],
};
export const specHash=createHash('sha256').update(JSON.stringify(spec)).digest('hex');
