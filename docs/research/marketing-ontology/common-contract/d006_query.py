"""Remaining question branches. Called only with validated RDF field readback."""
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from decimal import Decimal as D, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from d006_data import amount, ASOF

POLICY_VERSION = 'D006-policy-20261016.2'


def synthetic_paid(value, currency):
    """Approved mock policy, not a statement about any merchant's checkout."""
    quantum = {'JPY': D('1'), 'USD': D('0.01'), 'KRW': D('1')}[currency]
    return value.quantize(quantum, rounding=ROUND_HALF_UP)


def answer(test, rows, cutoff=ASOF, name='', errors=()):
    used = set()
    def select(typ=None, **conditions):
        result = sorted((r for r in rows.values() if (typ is None or r['record_id'].split('-')[1] == typ)
            and datetime.fromisoformat(r['available_at']) <= datetime.fromisoformat(cutoff)
            and all(r.get(k) == v for k,v in conditions.items())),key=lambda r:r['record_id'])
        used.update(r['record_id'] for r in result)
        return result
    def sumfield(part, field):
        return sum((D(str(r[field])) for r in part if r.get(field) is not None),D(0))
    def pick(rid):
        used.add(rid)
        return rows[rid]
    def quarter(typ, product=None, year=2026):
        return [r for r in select(typ,country_code='JP') if r['record_id'].startswith('D003B-') and r.get('period_start') in [f'{year}-{m:02}-01' for m in (7,8,9)] and (product is None or r.get('product_id')==product)]
    status, completeness, facts = 'answered','complete',{}
    if errors:
        facts={'errors':[{'record_id':rid,'code':code} for rid,code in errors]}
        used.update(rid for rid,_ in errors)
        return {'status':'execution_failed','completeness':'unknown','facts':facts,'used_ids':sorted(used)}
    if test in {'CQ01-2','CQ17-2'}:
        products=select('T01')
        names=defaultdict(list)
        for r in products:names[r['product_name']].append(r['product_id'])
        facts={'collisions':[sorted(v) for _,v in sorted(names.items()) if len(v)>1], 'auto_merged':False,
               'identity_basis':'D003B namespace + source product_id; name is not an identity key'}
        status='incomparable' if facts['collisions'] else 'answered'
        if test=='CQ17-2':
            if name=='foreign_price':
                candidate=pick('D003B-T08-0393')
                facts['excluded']=[{'record_id':candidate['record_id'],'reason':'country_mismatch'}] if candidate['country_code']!='JP' else []
            else:
                candidate=pick('D003B-T09-0001')
                facts['excluded']=[{'record_id':candidate['record_id'],'reason':'not_available_as_of'}] if datetime.fromisoformat(candidate['available_at'])>datetime.fromisoformat(cutoff) else []
    elif test=='CQ01-3':
        by_product={p:quarter('T03',p) for p in ['P1A','P2A']}
        missing={p:sorted(set(['2026-07-01','2026-08-01','2026-09-01'])-{r['period_start'] for r in part}) for p,part in by_product.items()}
        facts={'missing_months':missing,'share':None if any(missing.values()) else 'available','missing_replaced_with_zero':False}
        status='insufficient_data' if any(missing.values()) else 'answered';completeness='partial'
    elif test=='CQ02-2':
        old=sumfield(quarter('T03','P1A',2025),'units_sold');new=sumfield(quarter('T03','P1A'),'units_sold')
        facts={'baseline':str(old),'current':str(new),'absolute':str(new-old),'relative':str((new-old)/old) if old else None,'reason':None if old else 'denominator_zero'}
    elif test=='CQ06-4':
        event=select('T35',country_code='JP',product_id='P1A')[0]
        stock=select('T22',country_code='JP',product_id='P1A')
        part=[r for r in select('T13',country_code='JP',grain='day') if event['changed_at'][:10]<=r['period_start']<'2026-08-31']
        good=[r for r in part if r['conversions'] is not None]
        facts={'recovered_quantity':event['after_value'],'recovery_at':event['changed_at'],'zero_conversion_rows':sum(r['conversions']==0 for r in good),
               'received_rows':len(good),'missing_rows':len(part)-len(good),'known_conversions':str(sumfield(good,'conversions')),
               'stock_recovery_observed':any(r['available_quantity']>0 and r['observed_at']>=event['changed_at'] for r in stock),
               'causal_effect':None,'next_step':'inspect_other_causes'};completeness='partial'
    elif test=='CQ07-3':
        part=select('T13',country_code='JP',campaign_id='C-JP-search',grain='day')
        missing=[r['period_start'] for r in part if r['clicks'] is None]
        facts={'missing_click_dates':missing,'CVR':None if missing else str(sumfield(part,'conversions')/sumfield(part,'clicks')),
               'known_clicks':str(sumfield(part,'clicks')),'full_period_clicks':None if missing else str(sumfield(part,'clicks')),'zero_imputation':False,
               'known_metrics':{f:str(sumfield(part,f)) for f in ['impressions','clicks','conversions','spend','attributed_revenue']}}
        status='insufficient_data' if missing else 'answered';completeness='partial'
    elif test=='CQ07-4':
        values={}
        for year in [2025,2026]:
            part=[r for r in quarter('T13',year=year) if r['campaign_id']=='C-JP-social']
            spend=sumfield(part,'spend');revenue=sumfield(part,'attributed_revenue')
            values[str(year)]={'spend':str(spend),'ROAS':str(revenue/spend)}
        facts={'ads':values,'own_net_change':str(sumfield(quarter('H01','P1A'),'net_sales')-sumfield(quarter('H01','P1A',2025),'net_sales')),'automatic_budget_increase':False}
    elif test=='CQ12-2':
        definitions=select('T12',country_code='JP')
        advertisements=select('T13',grain='month')
        own=quarter('H01','P1A')
        facts={'purchase_names':sorted({r['conversion_name'] for r in definitions}),
               'metric_definitions':{r['campaign_id']:{'model':r['attribution_model'],'window_days':r['attribution_window_days'],
                   'metric_id':f"attributed_revenue/{r['campaign_id']}/{r['attribution_model']}/{r['attribution_window_days']}/JPY",'return_basis':'not_reconciled_to_H01_net'} for r in definitions},
               'currencies':sorted({r['currency'] for r in advertisements}),
               'own_gross':str(sumfield(own,'gross_sales')),'own_returns':str(sumfield(own,'returns_value')),
               'own_net':str(sumfield(own,'net_sales')),'attributed_value_equals_net_sales':False,'combined_value':None};status='incomparable'
    elif test in {'CQ14-1','CQ14-4'}:
        ids=['D006-T25-0001','D005-T25-0011'] if test=='CQ14-1' else ['D006-T25-0001','D006-T25-0002']
        spans=[]
        for rid in ids:
            ann=pick(rid);parent=pick(ann['review_ref'])
            spans.append({'annotation_id':rid,'review_id':ann['review_ref'],'product_id':parent['product_id'],
                'aspect':ann['aspect'],'sentiment':ann['sentiment'],'span':ann['evidence_span'],'assessment_status':ann['assessment_status']})
        facts={'annotations':spans,'rating_used_as_sentiment':False,'product_quality':None};completeness='sample'
    elif test=='CQ28-2':
        part=quarter('T03','P1A')
        missing=sorted({'2026-07-01','2026-08-01','2026-09-01'}-{r['period_start'] for r in part})
        facts={'missing_months':missing,'known_units':str(sumfield(part,'units_sold')),'full_units':None if missing else str(sumfield(part,'units_sold'))}
        status='insufficient_data' if missing else 'answered';completeness='partial' if missing else 'complete'
    elif test=='CQ04-2':
        part=select('T08',case_kind='scale');promo=pick('D003B-T09-0001')
        values=[amount(r['amount_raw'],r['amount_scale'],r['currency']) for r in part]
        start,end=map(datetime.fromisoformat,[promo['start_at'],promo['end_at_exclusive']])
        ratio=D(str(promo['discount_ratio']))
        times=[start,end-timedelta(seconds=1),end]
        facts={'normalized_prices':[str(v) for v in values],'source_amounts':[r['amount_raw'] for r in part],
               'active_at_start_before_end_at_end':[start<=t<end for t in times],
               'discounted_exact_intermediate':[str(v*(1-ratio)) for v in values],
               'final_paid_before_end':[str(synthetic_paid(v*(1-ratio), r['currency'])) for v,r in zip(values,part)],
               'rounding_policy':'SYNTHETIC-HALF-UP-1','rounding_policy_origin':'user_authorized_mock_assumption',
               'actual_merchant_policy_verified':False,'paid_at_end':[str(v) for v in values], 'scale_inferred':False}
    elif test=='CQ04-4':
        part=select('T08',case_kind='shipping')
        display={r['product_id']:amount(r['amount_raw'],r['amount_scale'],r['currency']) for r in part}
        paid={r['product_id']:display[r['product_id']]+D(r['shipping_fee']) for r in part}
        facts={'display':{k:str(v) for k,v in display.items()},'total_paid':{k:str(v) for k,v in paid.items()},
               'display_winner':min(display,key=display.get),'total_paid_winner':min(paid,key=paid.get),'universal_advantage':False}
    elif test in {'CQ06-2','CQ23-2'}:
        days=sorted({r['boundary_day'] for r in select('T22',scenario_id='D006-CQ-B')})
        boundaries=[]
        for day in days:
            zone=ZoneInfo('America/New_York');start=datetime.fromisoformat(day).replace(tzinfo=zone)
            end=(start+timedelta(days=1))
            elapsed=(end.astimezone(timezone.utc)-start.astimezone(timezone.utc)).total_seconds()/3600
            snapshots=select('T22',boundary_day=day)
            configs=select('T12',boundary_day=day)
            cut=datetime.fromisoformat(configs[0]['valid_to_exclusive'])
            before=[r['record_id'] for r in configs if datetime.fromisoformat(r['valid_from'])<=cut-timedelta(seconds=1)<datetime.fromisoformat(r['valid_to_exclusive'])]
            exact=[r['record_id'] for r in configs if datetime.fromisoformat(r['valid_from'])<=cut<datetime.fromisoformat(r['valid_to_exclusive'])]
            ad=select('T13',boundary_day=day,case_kind='time')
            money=select('T03',boundary_day=day)
            boundaries.append({'day':day,'hours':int(elapsed),'snapshot_count':len(snapshots),'continuous_stockout_hours':None,
                'config_before':before,'config_at_boundary':exact,'mixed_setting_comparison':False,
                'account_zones':sorted({r['reporting_timezone'] for r in ad}),
                'full_periods_utc':sorted({(datetime.fromisoformat(r['period_start']).astimezone(timezone.utc).isoformat(),datetime.fromisoformat(r['period_end_exclusive']).astimezone(timezone.utc).isoformat()) for r in ad if r['series_role']=='full'}),
                'partial_auto_compared':False,'money':{r['currency']:format(amount(r['sales_raw'],r['amount_scale'],r['currency']),'.2f') for r in money},'cross_currency_sum':None,
                'repeated_0130_utc':[datetime.fromisoformat(day+'T01:30:00'+offset).astimezone(timezone.utc).isoformat() for offset in ['-04:00','-05:00']] if elapsed==25 else []})
        facts={'boundaries':boundaries};status='incomparable';completeness='partial'
    elif test=='CQ07-2':
        alternatives=select('T13',case_kind='revision')
        facts={'selected':{},'monthly_plus_daily_summed':False,'ratios_averaged':False}
        for key in sorted({r['logical_key'] for r in rows.values() if r.get('case_kind')=='revision'}):
            candidates=[pick(key)]+[r for r in alternatives if r['logical_key']==key]
            latest=max(candidates,key=lambda r:r.get('revision',0))
            facts['selected'][key]={'record_id':latest['record_id'],'revision':latest.get('revision',0),'spend':latest['spend'],
                'CTR':str(D(latest['clicks'])/D(latest['impressions'])),'ROAS':str(D(latest['attributed_revenue'])/D(latest['spend']))}
        # Across each campaign's Q3, choose the baseline tier once. The day tier
        # remains a separate drilldown and is not added to that quarter total.
        months=[r for r in quarter('T13') if r['grain']=='month']
        monthly=[]
        for row in months:
            candidate=[r for r in alternatives if r['logical_key']==row['record_id']]
            monthly.append(max(candidate,key=lambda r:r['revision']) if candidate else row)
        facts['Q3_known_spend']=str(sumfield(monthly,'spend'))
        facts['Q3_spend']=str(sumfield(monthly,'spend')) if len(monthly)==6 else None
        facts['Q3_CTR']=str(sumfield(monthly,'clicks')/sumfield(monthly,'impressions')) if len(monthly)==6 else None
        facts['Q3_ROAS']=str(sumfield(monthly,'attributed_revenue')/sumfield(monthly,'spend')) if len(monthly)==6 else None
        completeness='complete' if len(monthly)==6 else 'partial'
    elif test in {'CQ15-1','CQ15-4'}:
        reviews=select('T24',scenario_id='D006-CQ-B');runs=select('T36',target_dataset='T24')
        by_run={r['run_id']:r for r in runs}
        periods=defaultdict(list)
        for r in {r['review_id']:r for r in reviews}.values():
            periods[by_run[r['collection_run_id']]['expected_start']].append(r)
        reports={}
        for period,part in sorted(periods.items()):
            sellers={}
            for seller in sorted({r['seller_id'] for r in part}):
                subset=[r for r in part if r['seller_id']==seller];rated=[r for r in subset if r['rating_value'] is not None]
                low=sum(r['rating_value']<=2 for r in rated)
                sellers[seller]={'sample':len(subset),'rated':len(rated),'low':low,'rate':str(D(low)/len(rated)) if rated else None,'excluded':len(subset)-len(rated)}
            rated=sum(x['rated'] for x in sellers.values());low=sum(x['low'] for x in sellers.values())
            reports[period]={'sellers':sellers,'rated':rated,'low':low,'rate':str(D(low)/rated) if rated else None,
                'equal_seller_weight_rate':str(sum(D(x['rate']) for x in sellers.values())/len(sellers)) if all(x['rate'] is not None for x in sellers.values()) else None}
        facts={'periods':reports,'coverage':'sample','population_rate':None,'quality_cause':None,'rating_threshold':[1,2],'sentiment_inferred':False};completeness='sample'
    else:
        raise ValueError('unimplemented D006 question: '+test)
    return {'status':status,'completeness':completeness,'facts':facts,'used_ids':sorted(used)}
