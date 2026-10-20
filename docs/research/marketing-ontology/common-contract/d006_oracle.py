"""Independent source ledger. No imports from generation, query or RDF code."""
from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
BATCHES=HERE.parent/'batches'
NUM=Decimal


def read_sources():
    result={}
    for batch in ['D003B','D006-CQ-A','D006-CQ-B']:
        manifest=json.loads((BATCHES/batch/'manifest.json').read_text(encoding='utf-8'))
        specs=manifest['files']
        specs=[{'path':str((BATCHES/batch/'source'/name).relative_to(ROOT)),'rows':x['records'],'sha256':x['sha256']} for name,x in specs.items()] if isinstance(specs,dict) else specs
        for spec in specs:
            raw=(ROOT/spec['path']).read_bytes()
            assert hashlib.sha256(raw).hexdigest()==spec['sha256']
            lines=raw.decode().splitlines();assert len(lines)==spec['rows']
            for line in lines:
                row=json.loads(line)
                if 'metadata' in row:
                    assert row['source_profile']=='A'
                    row=dict(row['metadata'],**row['payload'])
                assert row['record_id'] not in result
                result[row['record_id']]=row
    p=BATCHES/'D005/source/T25.jsonl'
    manifest=json.loads((BATCHES/'D005/manifest.json').read_text(encoding='utf-8'))
    spec=next(f for f in manifest['files'] if Path(f['path']).name=='T25.jsonl')
    assert hashlib.sha256(p.read_bytes()).hexdigest()==spec['sha256']
    for line in p.read_text(encoding='utf-8').splitlines():
        row=json.loads(line);rid=row['metadata']['record_id']
        if rid=='D005-T25-0011':result[rid]=dict(row['metadata'],**row['payload'])
        if rid=='D005-T25-0009':
            p=row['payload']
            result[rid]=dict(row['metadata'],record_kind=p['recordKind'],review_ref=p['reviewRef'],product_ref=p['productRef'],
                aspect=p['aspect'],sentiment=p['sentiment'],evidence_span=p['evidenceSpan'],assessment_status=p['assessmentStatus'])
    return result


def branch_input(original, name):
    """A separately coded approved mutation ledger, not the production mutator."""
    data=deepcopy(original);asof='2026-10-06T00:00:00+09:00'
    if name in ['collision','foreign_price','future_promotion']:
        data['D003B-T01-0003']['product_name']=data['D003B-T01-0001']['product_name']
    if name in ['missing_month','remove_evidence']:
        data.pop('D003B-T03-0279' if name=='missing_month' else 'D003B-T03-0283')
    if name=='zero_baseline':
        for rid in ['D003B-T03-0199','D003B-T03-0205','D003B-T03-0211']:
            data[rid]['units_sold']=0;data[rid]['sales_value']='0.00'
    if name=='recovery_counter':
        for rid,row in data.items():
            if rid.startswith('D003B-T13') and row['country_code']=='JP' and row['grain']=='day' and row['period_start'] in ['2026-08-%02d'%n for n in range(19,31)] and row['conversions'] is not None:
                row['conversions']=0;row['attributed_revenue']='0.00'
    if name=='missing_clicks':
        row=data['D003B-T13-0129']
        for key in ['impressions','clicks','conversions','spend','attributed_revenue']:row[key]=None
        row['availability']='missing'
    if name=='half_spend':
        for rid in ['D003B-T13-0178','D003B-T13-0179','D003B-T13-0180']:
            data[rid]['spend']=format(NUM(data[rid]['spend'])/NUM('2'),'.2f')
    if name=='bad_counts':data['D003B-T36-0004']['received_count']=25
    if name=='different_definition':
        data['D003B-T12-0004']['attribution_model']='first_click';data['D003B-T12-0004']['attribution_window_days']=1
    if name=='wrong_product':data['D006-T25-0001']['product_ref']='P2A'
    if name=='wrong_span':data['D006-T25-0001']['evidence_span']['start']=1
    if name=='future_promotion':data['D003B-T09-0001']['available_at']='2026-10-06T00:00:01+09:00'
    if name=='early_asof':asof='2026-09-30T00:00:00+09:00'
    return data,asof


def error_ledger(rows):
    issues=[]
    for rid,r in rows.items():
        if 'received_count' in r and r['expected_count']-r['received_count']!=r['missing_count']:
            issues.append((rid,'count_mismatch'))
        if 'evidence_span' in r:
            parent=rows[r['review_ref']];span=r['evidence_span']
            if parent['product_id']!=r['product_ref']:issues.append((rid,'review_product_mismatch'))
            elif ''.join(list(parent['body_text'])[span['start']:span['end']])!=span['quote']:issues.append((rid,'span_mismatch'))
    return sorted(issues)


def expected(test, data, cutoff, name):
    visible=[r for r in data.values() if datetime.fromisoformat(r['available_at'])<=datetime.fromisoformat(cutoff)]
    if test not in ['CQ04-2','CQ04-4','CQ06-2','CQ07-2','CQ15-1','CQ15-4','CQ23-2']:
        visible=[r for r in visible if r.get('scenario_id')!='D006-CQ-B']
    def get(typ,**values):
        return sorted([r for r in visible if r['record_id'].split('-')[1]==typ and all(r.get(k)==v for k,v in values.items())],key=lambda r:r['record_id'])
    def q(typ,p=None,year=2026):
        return [r for r in get(typ,country_code='JP') if r['record_id'].split('-')[0]=='D003B' and r.get('period_start') in [f'{year}-07-01',f'{year}-08-01',f'{year}-09-01'] and (p is None or r.get('product_id')==p)]
    def total(part,key):return sum([NUM(str(r[key])) for r in part if r.get(key) is not None],NUM(0))
    errors=error_ledger(data)
    if errors:return 'execution_failed','unknown',{'errors':[{'record_id':r,'code':c} for r,c in errors]}
    state,complete='answered','complete'
    if test in ['CQ01-2','CQ17-2']:
        groups={}
        for row in get('T01'):groups.setdefault(row['product_name'],[]).append(row['product_id'])
        facts={'collisions':[sorted(ids) for _,ids in sorted(groups.items()) if len(ids)>1],'auto_merged':False,
               'identity_basis':'D003B namespace + source product_id; name is not an identity key'}
        state='incomparable'
        if test=='CQ17-2':facts['excluded']=[{'record_id':'D003B-T08-0393' if name=='foreign_price' else 'D003B-T09-0001','reason':'country_mismatch' if name=='foreign_price' else 'not_available_as_of'}]
    elif test=='CQ01-3':
        facts={'missing_months':{p:sorted(set(['2026-07-01','2026-08-01','2026-09-01']).difference(r['period_start'] for r in q('T03',p))) for p in ['P1A','P2A']},'share':None,'missing_replaced_with_zero':False};state='insufficient_data';complete='partial'
    elif test=='CQ02-2':
        a=total(q('T03','P1A',2025),'units_sold');b=total(q('T03','P1A'),'units_sold')
        assert a==0 and b==4995
        facts={'baseline':str(a),'current':str(b),'absolute':str(b-a),'relative':None,'reason':'denominator_zero'}
    elif test=='CQ06-4':
        recovery=get('T35',country_code='JP',product_id='P1A')[0]
        part=[r for r in get('T13',country_code='JP',grain='day') if '2026-08-19'<=r['period_start']<='2026-08-30']
        measured=[r for r in part if r['conversions'] is not None]
        assert len(measured)==22 and all(r['conversions']==0 for r in measured) and len(part)==24
        facts={'recovered_quantity':recovery['after_value'],'recovery_at':recovery['changed_at'],'zero_conversion_rows':22,'received_rows':22,'missing_rows':2,'known_conversions':'0',
               'stock_recovery_observed':any(r['available_quantity']>0 and r['observed_at']>=recovery['changed_at'] for r in get('T22',country_code='JP',product_id='P1A')),'causal_effect':None,'next_step':'inspect_other_causes'};complete='partial'
    elif test=='CQ07-3':
        part=get('T13',country_code='JP',campaign_id='C-JP-search',grain='day')
        assert data['D003B-T13-0129']['clicks'] is None
        facts={'missing_click_dates':[r['period_start'] for r in part if r['clicks'] is None],'CVR':None,'known_clicks':str(total(part,'clicks')),'full_period_clicks':None,'zero_imputation':False,
               'known_metrics':{f:str(total(part,f)) for f in ['impressions','clicks','conversions','spend','attributed_revenue']}};state='insufficient_data';complete='partial'
    elif test=='CQ07-4':
        values={}
        for year in [2025,2026]:
            part=[r for r in q('T13',year=year) if r['campaign_id']=='C-JP-social'];spend=total(part,'spend')
            values[str(year)]={'spend':str(spend),'ROAS':str(total(part,'attributed_revenue')/spend)}
        change=total(q('H01','P1A'),'net_sales')-total(q('H01','P1A',2025),'net_sales')
        assert NUM(values['2026']['spend'])<NUM(values['2025']['spend']) and NUM(values['2026']['ROAS'])>NUM(values['2025']['ROAS']) and change<0
        facts={'ads':values,'own_net_change':str(change),'automatic_budget_increase':False}
    elif test=='CQ12-2':
        own=q('H01','P1A');definitions=get('T12',country_code='JP')
        assert len({(r['attribution_model'],r['attribution_window_days']) for r in definitions})>1
        facts={'purchase_names':sorted(set(r['conversion_name'] for r in definitions)),
            'metric_definitions':{r['campaign_id']:{'model':r['attribution_model'],'window_days':r['attribution_window_days'],
                'metric_id':'/'.join(['attributed_revenue',r['campaign_id'],r['attribution_model'],str(r['attribution_window_days']),'JPY']),'return_basis':'not_reconciled_to_H01_net'} for r in definitions},
            'currencies':sorted(set(r['currency'] for r in get('T13',grain='month'))),
            'own_gross':str(total(own,'gross_sales')),'own_returns':str(total(own,'returns_value')),'own_net':str(total(own,'net_sales')),'attributed_value_equals_net_sales':False,'combined_value':None};state='incomparable'
        assert len(facts['currencies'])>1 and NUM(facts['own_returns'])>0 and NUM(facts['own_gross'])-NUM(facts['own_returns'])==NUM(facts['own_net'])
    elif test in ['CQ14-1','CQ14-4']:
        ids=['D006-T25-0001','D005-T25-0011'] if test=='CQ14-1' else ['D006-T25-0001','D006-T25-0002']
        annotations=[]
        for rid in ids:
            ann=data[rid];review=data[ann['review_ref']]
            assert review['body_text'][ann['evidence_span']['start']:ann['evidence_span']['end']]==ann['evidence_span']['quote']
            annotations.append({'annotation_id':rid,'review_id':ann['review_ref'],'product_id':review['product_id'],'aspect':ann['aspect'],'sentiment':ann['sentiment'],'span':ann['evidence_span'],'assessment_status':'provided'})
        facts={'annotations':annotations,'rating_used_as_sentiment':False,'product_quality':None};complete='sample'
    elif test=='CQ28-2':
        part=q('T03','P1A');missing=sorted(set(['2026-07-01','2026-08-01','2026-09-01']).difference(r['period_start'] for r in part))
        facts={'missing_months':missing,'known_units':str(total(part,'units_sold')),'full_units':None if missing else str(total(part,'units_sold'))}
        state='insufficient_data' if missing else 'answered';complete='partial' if missing else 'complete'
    elif test=='CQ04-2':
        a=data['D006B-T08-0001'];b=data['D006B-T08-0002']
        assert a['amount_scale']=='micros' and b['amount_scale']=='decimal'
        values=[NUM(a['amount_raw'])/NUM('1000000'),NUM(b['amount_raw'])]
        discount=NUM(str(data['D003B-T09-0001']['discount_ratio']))
        facts={'normalized_prices':[str(v) for v in values],'source_amounts':[a['amount_raw'],b['amount_raw']],
            'active_at_start_before_end_at_end':[True,True,False],'discounted_exact_intermediate':[str(v-v*discount) for v in values],
            'final_paid_before_end':[str(int(v-v*discount+NUM('0.5'))) for v in values],
            'rounding_policy':'SYNTHETIC-HALF-UP-1','rounding_policy_origin':'user_authorized_mock_assumption',
            'actual_merchant_policy_verified':False,'paid_at_end':[str(v) for v in values],'scale_inferred':False}
    elif test=='CQ04-4':
        offers=get('T08',case_kind='shipping');display={r['product_id']:NUM(r['amount_raw']) for r in offers}
        paid={r['product_id']:NUM(r['amount_raw'])+NUM(r['shipping_fee']) for r in offers}
        assert display['P1A']<display['P2A'] and paid['P1A']>paid['P2A']
        assert len({(r['currency'],r['destination'],r['quantity'],r['observed_at'],r['volume_ml'],r['tax_included']) for r in offers})==1
        facts={'display':{k:str(v) for k,v in display.items()},'total_paid':{k:str(v) for k,v in paid.items()},'display_winner':'P1A','total_paid_winner':'P2A','universal_advantage':False}
    elif test in ['CQ06-2','CQ23-2']:
        boundaries=[]
        # Hand ledger of actual UTC endpoints, independent from ZoneInfo arithmetic.
        for j,(day,start,end,hours) in enumerate([('2025-11-02','2025-11-02T04:00:00+00:00','2025-11-03T05:00:00+00:00',25),('2026-03-08','2026-03-08T05:00:00+00:00','2026-03-09T04:00:00+00:00',23)]):
            configs=get('T12',boundary_day=day);snaps=get('T22',boundary_day=day);ads=get('T13',case_kind='time',boundary_day=day)
            assert len(configs)==2 and len(snaps)==3 and len(ads)==4
            assert datetime.fromisoformat(configs[0]['valid_to_exclusive'])==datetime.fromisoformat(configs[1]['valid_from'])
            monetary={r['currency']:format(NUM(r['sales_raw'])/(NUM('100') if r['currency']=='USD' else NUM('1')),'.2f') for r in get('T03',boundary_day=day)}
            for r in ads:
                if r['series_role']=='full':
                    assert datetime.fromisoformat(r['period_start']).astimezone(timezone.utc).isoformat()==start
                    assert datetime.fromisoformat(r['period_end_exclusive']).astimezone(timezone.utc).isoformat()==end
                else:assert datetime.fromisoformat(r['period_start'])>datetime.fromisoformat(start)
            boundaries.append({'day':day,'hours':hours,'snapshot_count':3,'continuous_stockout_hours':None,
                'config_before':[f'D006B-T12-{j*2+1:04}'],'config_at_boundary':[f'D006B-T12-{j*2+2:04}'],
                'mixed_setting_comparison':False,'account_zones':['America/New_York','UTC'],'full_periods_utc':[(start,end)],
                'partial_auto_compared':False,'money':monetary,'cross_currency_sum':None,
                'repeated_0130_utc':['2025-11-02T05:30:00+00:00','2025-11-02T06:30:00+00:00'] if hours==25 else []})
        facts={'boundaries':boundaries};state='incomparable';complete='partial'
    elif test=='CQ07-2':
        revisions=get('T13',case_kind='revision')
        facts={'selected':{},'monthly_plus_daily_summed':False,'ratios_averaged':False}
        for key in sorted(set(r['logical_key'] for r in revisions)):
            newest=sorted([data[key]]+[r for r in revisions if r['logical_key']==key],key=lambda x:x.get('revision',0))[-1]
            facts['selected'][key]={'record_id':newest['record_id'],'revision':newest.get('revision',0),'spend':newest['spend'],
                'CTR':str(NUM(newest['clicks'])/NUM(newest['impressions'])),'ROAS':str(NUM(newest['attributed_revenue'])/NUM(newest['spend']))}
        months={r['record_id']:r for r in q('T13') if r['grain']=='month'}
        for r in revisions:
            if r['grain']=='month' and r['logical_key'] in months:months[r['logical_key']]=r
        part=list(months.values())
        facts.update(Q3_known_spend=str(total(part,'spend')),Q3_spend=str(total(part,'spend')),Q3_CTR=str(total(part,'clicks')/total(part,'impressions')),Q3_ROAS=str(total(part,'attributed_revenue')/total(part,'spend')))
        assert all(v['revision']==1 for v in facts['selected'].values())
    elif test in ['CQ15-1','CQ15-4']:
        logs=get('T36',target_dataset='T24');result={}
        for start in sorted(set(r['expected_start'] for r in logs)):
            sellers={}
            for log in [r for r in logs if r['expected_start']==start]:
                selected={r['review_id']:r for r in get('T24',scenario_id='D006-CQ-B') if r['collection_run_id']==log['run_id']}
                assert len(selected)==log['received_count']
                assert all(log['expected_start']<=r['written_at'][:10]<log['expected_end_exclusive'] and r['seller_id']==log['seller_id'] and r['product_id']==log['product_id'] for r in selected.values())
                rated=[r for r in selected.values() if r['rating_value'] is not None];low=len([r for r in rated if r['rating_value'] in [1,2]])
                sellers[log['seller_id']]={'sample':len(selected),'rated':len(rated),'low':low,'rate':str(NUM(low)/len(rated)) if rated else None,'excluded':len(selected)-len(rated)}
            low=sum(v['low'] for v in sellers.values());rated=sum(v['rated'] for v in sellers.values())
            result[start]={'sellers':sellers,'rated':rated,'low':low,'rate':str(NUM(low)/rated),
                'equal_seller_weight_rate':str(sum(NUM(v['rate']) for v in sellers.values())/len(sellers))}
        assert [v['rate'] for v in result.values()]==['0.2','0.8']
        assert all(v['equal_seller_weight_rate']=='0.5' for v in result.values())
        facts={'periods':result,'coverage':'sample','population_rate':None,'quality_cause':None,'rating_threshold':[1,2],'sentiment_inferred':False};complete='sample'
    else:raise ValueError('missing oracle: '+test)
    return state,complete,facts


def canonical(value):
    return json.dumps(value,sort_keys=True,ensure_ascii=False,default=str)


def check(test,name,cutoff,actual,independent,production_input):
    checks=[]
    def verify(label,ok):checks.append({'name':label,'status':'pass' if ok else 'fail'})
    expected_input,expected_cutoff=branch_input(independent,name)
    verify('independent_mutation_and_cutoff',production_input==expected_input and cutoff==expected_cutoff)
    state,complete,facts=expected(test,expected_input,cutoff,name)
    verify('independent_answer_status',actual['status']==state)
    verify('independent_completeness',actual['completeness']==complete)
    verify('independent_all_facts',canonical(actual['facts'])==canonical(facts))
    if actual['facts']!=facts:
        checks[-1]['expected']=facts
    verify('guard_vs_substantive',actual.get('substantive_answer')==(state=='answered'))
    if test=='CQ02-2':verify('zero_denominator_reason',actual['null_reasons'].get('facts.relative')=='denominator_zero')
    if test=='CQ04-2':verify('synthetic_rounding_is_explicit',actual['facts']['final_paid_before_end']==['1111','1111'] and actual['facts']['actual_merchant_policy_verified'] is False)
    if test=='CQ07-3':verify('missing_clicks_reason',actual['null_reasons'].get('facts.CVR')=='missing_clicks')
    verify('business_and_provider_review_not_fabricated',actual.get('business_review')=='pending_user_review' and actual.get('actual_provider_fit')=='not_run')
    return checks
