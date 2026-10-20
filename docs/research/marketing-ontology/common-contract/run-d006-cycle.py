"""Approved remaining-20 cycle; no generation on validate, no persistent RDF."""
import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import subprocess
import sys

import d006_data as data
from d006_query import answer, synthetic_paid, POLICY_VERSION
from d006_rdf import project, leaves
import d006_oracle as oracle


def subset(test, rows, name):
    types = {'CQ01-2':['T01'],'CQ01-3':['T03'],'CQ02-2':['T03'],'CQ06-4':['T13','T22','T35'],
             'CQ07-3':['T13'],'CQ07-4':['T13','H01'],'CQ11-2':['T36'],'CQ12-2':['T12','T13','H01'],
             'CQ14-1':['T24','T25'],'CQ14-2':['T24','T25'],'CQ14-4':['T24','T25'],
             'CQ17-2':['T01','T08','T09'],'CQ28-2':['T03'],'CQ04-2':['T08','T09'],
             'CQ04-4':['T08'],'CQ06-2':['T22','T12','T13','T03'],'CQ07-2':['T13'],
             'CQ15-1':['T24','T36'],'CQ15-4':['T24','T36'],'CQ23-2':['T22','T12','T13','T03']}[test]
    selected={}
    for rid,row in rows.items():
        typ=rid.split('-')[1]
        if typ not in types:continue
        is_b=rid.startswith('D006B-')
        if test in ['CQ06-2','CQ23-2','CQ04-4','CQ15-1','CQ15-4'] and not is_b:continue
        if test in ['CQ06-2','CQ23-2'] and row.get('case_kind')=='revision':continue
        if test=='CQ04-2' and not (is_b or typ=='T09'):continue
        if test not in ['CQ06-2','CQ23-2','CQ04-4','CQ15-1','CQ15-4','CQ04-2','CQ07-2'] and is_b:continue
        if test in ['CQ14-1','CQ14-2','CQ14-4']:
            if rid not in ['D006-T24-0001','D006-T25-0001','D006-T25-0002','D005-T25-0009','D005-T25-0011','D003B-T24-0005','D003B-T24-0006']:continue
        elif test in ['CQ01-3','CQ02-2','CQ28-2','CQ06-4','CQ07-3','CQ07-4','CQ11-2']:
            if row.get('country_code')!='JP':continue
            if typ in ['T03','H01'] and row['period_start'] not in [f'{y}-{m:02}-01' for y in [2025,2026] for m in [7,8,9]]:continue
        if test=='CQ17-2' and typ in ['T08','T09'] and rid not in ['D003B-T08-0393','D003B-T09-0001']:continue
        if test=='CQ07-2' and (row.get('case_kind')=='time' or row.get('country_code')!='JP'):continue
        selected[rid]=row
    return selected


def verdict(checks):
    return 'fail' if any(c['status']=='fail' for c in checks) else 'not_run' if not checks or any(c['status']!='pass' for c in checks) else 'pass'


def response(test, name, original, refs, cutoff, tools):
    picked=subset(test,original,name)
    errors=data.semantic_errors(picked)
    if errors:
        # Invalid variants stop at the declared validation layer. An expected
        # contract rejection is not an unhandled query exception.
        result=answer(test,picked,cutoff,name,errors)
        rdf={'status':'not_projected','reason':'semantic_admission_rejection'}
        if test=='CQ11-2':
            try:project(picked,refs,tools)
            except ValueError as e:
                if not str(e).startswith('SHACL:'):raise
                rdf={'status':'expected_rejection','stage':'SHACL','reason':'count_mismatch'}
            else:raise AssertionError('invalid collection counts accepted by SHACL')
    else:
        readback,rdf=project(picked,refs,tools)
        result=answer(test,readback,cutoff,name)
    result.update(as_of=cutoff,substantive_answer=result['status']=='answered',scope_id='D006-CQ-AB-1',
                  business_review='pending_user_review',actual_provider_fit='not_run')
    result['business_definition_review']='confirmed_by_user_decisions_2A_3A'
    result['evidence']={rid:{**refs[rid],'normalized_fields':[p for p,_ in leaves(original[rid])],
        'fields':[p for p,_ in leaves(json.loads((data.ROOT/refs[rid]['file']).read_text(encoding='utf-8').splitlines()[refs[rid]['line']-1]))],
        'mapping_version':data.VERSION,'policy_version':POLICY_VERSION,'as_of':cutoff,
        'role':'excluded_candidate' if datetime.fromisoformat(original[rid]['available_at'])>datetime.fromisoformat(cutoff) else 'basis'} for rid in result.pop('used_ids')}
    reasons={'relative':'denominator_zero','share':'missing_comparison_month','CVR':'missing_clicks',
             'full_period_clicks':'missing_period','full_units':'missing_period',
             'continuous_stockout_hours':'snapshots_not_continuous_duration','cross_currency_sum':'fx_not_provided',
             'combined_value':'incompatible_metric_definitions','causal_effect':'not_inferred_from_observations',
             'quality_cause':'not_inferred_from_observations','product_quality':'not_inferred_from_observations',
             'population_rate':'sample_not_population'}
    result['null_reasons']={p:reasons.get(p.rsplit('.',1)[-1],'missing_period') for p,v in leaves(result['facts'],'facts') if v is None}
    return result,rdf


def evidence_checks(result,original,refs):
    valid=bool(result['evidence'])
    for rid,ref in result['evidence'].items():
        path=data.ROOT/ref['file']
        valid &= ref['sha256']==data.sha(path) and ref['line']==refs[rid]['line']
        raw=json.loads(path.read_text(encoding='utf-8').splitlines()[ref['line']-1])
        valid &= raw.get('record_id',raw.get('metadata',{}).get('record_id'))==rid
        valid &= set(ref['normalized_fields'])=={p for p,_ in leaves(original[rid])}
        valid &= set(ref['fields'])=={p for p,_ in leaves(raw)}
        valid &= ref['role']=='excluded_candidate' or datetime.fromisoformat(original[rid]['available_at'])<=datetime.fromisoformat(result['as_of'])
    nulls={p for p,v in leaves(result['facts'],'facts') if v is None}
    return [{'name':'evidence_file_hash_record_fields_asof', 'status':'pass' if valid else 'fail'},
            {'name':'every_withheld_value_has_reason','status':'pass' if nulls==set(result['null_reasons']) else 'fail'}]


def fault_checks(original,refs,tools):
    cases=[]
    expected={'ambiguous_fall':'ambiguous_local_time','nonexistent_spring':'nonexistent_local_time',
              'overlapping_config':'config_overlap','unknown_scale':'unknown_scale',
              'fractional_minor':'fractional_minor','missing_seller':'seller_missing',
              'review_count_mismatch':'count_mismatch'}
    for name in data.FAULTS:
        varied=data.fault(name,original)
        raw=[]
        for rid,row in varied.items():
            if rid.startswith('D006B-'):
                ref=refs[rid]
                stored=json.loads((data.ROOT/ref['file']).read_text(encoding='utf-8').splitlines()[ref['line']-1])
                meta={k:row[k] for k in stored['metadata'] if k in row}
                payload={k:v for k,v in row.items() if k not in stored['metadata']}
                raw.append({'source_profile':'A','metadata':meta,'payload':payload})
        compiled=subprocess.run(['node',str(data.HERE/'d006-schema.mjs')],input=json.dumps(raw,ensure_ascii=False),text=True,encoding='utf-8',capture_output=True)
        schema_failures={'ambiguous_fall','unknown_scale','fractional_minor','missing_seller'}
        schema_result=json.loads(compiled.stdout)
        errors=data.semantic_errors(varied)
        codes={code for _,code in errors}
        if name in schema_failures:
            ok=compiled.returncode==1 and schema_result['status']=='fail' and expected[name] in codes;stage='source_schema'
        elif name in expected:
            ok=expected[name] in codes;stage='semantic_admission'
        elif name=='snapshot_gap':
            out,_=response('CQ06-2',name,varied,refs,data.ASOF,tools)
            ok=out['status']=='incomparable' and out['facts']['boundaries'][0]['snapshot_count']==2 and all(x['continuous_stockout_hours'] is None for x in out['facts']['boundaries']);stage='query'
        elif name=='null_rating':
            out,_=response('CQ15-1',name,varied,refs,data.ASOF,tools)
            p=out['facts']['periods']['2026-08-03']
            ok=not errors and p['rated']==9 and p['low']==2 and p['sellers']['D006B-S-A']['excluded']==1;stage='query'
        else:
            # Re-loading the identical source identity must be idempotent; it
            # must not create a second review or inflate a denominator.
            items=list(varied.values())+[varied['D006B-T24-0001']]
            dedup={r['record_id']:r for r in items}
            out,_=response('CQ15-1',name,dedup,refs,data.ASOF,tools)
            ok=out['facts']['periods']['2026-08-03']['rated']==10;stage='identity_ingestion'
        if name not in schema_failures:ok=ok and compiled.returncode==0
        cases.append({'id':name,'status':'pass' if ok else 'fail','stage':stage,'error_codes':sorted(codes),'schema_status':schema_result['status']})
    return cases


def run(approval,tools):
    scope=data.authorized(approval)
    assert sum(map(len,data.A_CASES.values()))-2==16 and len(data.FAULTS)==10
    tracked=[data.ROOT/p for p in scope['immutable_inputs']]
    for batch in data.COUNTS:
        manifest=data.BATCHES/batch/'manifest.json';tracked.append(manifest)
        tracked += [data.ROOT/f['path'] for f in data.load(manifest)['files']]
    tracked += [data.HERE/n for n in ['d006-scope.json','d006-input-lock.json','d006-approval-20261016.json','question-revisions-20261016.json','meaning-decisions-20261016.json','d006_data.py','d006_query.py','d006_oracle.py','d006_rdf.py','d006-schema.mjs','run-d006-cycle.py']]
    tracked.append(data.BATCHES/'D006-CQ-B/sellers.json')
    before={p.relative_to(data.ROOT).as_posix():data.sha(p) for p in tracked}
    allrows,refs=data.sources(approval);independent=oracle.read_sources()
    assert allrows==independent,'independent source decoding differs'
    sellers=data.load(data.BATCHES/'D006-CQ-B/sellers.json')
    assert {r['seller_id'] for r in sellers}=={'D006B-S-A','D006B-S-B'} and all(r['country_code']=='JP' and r['is_synthetic'] is True for r in sellers)
    raw=[]
    for batch in data.COUNTS:
        for p in (data.BATCHES/batch/'source').glob('*.jsonl'):
            raw += [json.loads(x) for x in p.read_text(encoding='utf-8').splitlines()]
    schema=subprocess.run(['node',str(data.HERE/'d006-schema.mjs')],input=json.dumps(raw,ensure_ascii=False),text=True,encoding='utf-8',capture_output=True)
    assert schema.returncode==0,schema.stdout+schema.stderr
    assert not data.semantic_errors(allrows)
    checks=[{'name':'source_schema_compile_and_validation','status':'pass','result':json.loads(schema.stdout)},
            {'name':'source_counts_and_semantic_contract','status':'pass','source_rows':56,'files':9,'seller_declarations':2}]
    from decimal import Decimal
    # Arithmetic policy boundaries only; these are not new marketing records.
    rounding=[('1110.49','JPY','1110'),('1110.50','JPY','1111'),('1110.60','JPY','1111'),
              ('1.004','USD','1.00'),('1.005','USD','1.01'),('-1.005','USD','-1.01'),('1110.50','KRW','1111')]
    assert all(str(synthetic_paid(Decimal(value),currency))==expected for value,currency,expected in rounding)
    checks.append({'name':'synthetic_half_up_minor_unit_policy','status':'pass','policy':'SYNTHETIC-HALF-UP-1','boundary_checks':len(rounding),
                   'actual_merchant_policy_verified':False})
    results=[]
    for test,names in {**data.A_CASES,**data.B_CASES}.items():
        branches=[]
        for name in names:
            varied,cutoff=data.branch(test,name,allrows)
            out,rdf=response(test,name,varied,refs,cutoff,tools)
            assertions=oracle.check(test,name,cutoff,out,independent,varied)+evidence_checks(out,varied,refs)
            replay,replayrdf=response(test,name,dict(reversed(list(varied.items()))),refs,cutoff,tools)
            assertions += [{'name':'same_input_replay_and_reverse','status':'pass' if out==replay and rdf==replayrdf else 'fail'}]
            if test=='CQ28-2' and name in ['replay','unrelated']:
                selection=data.load(data.HERE/'batch-selection.json')
                small_ids={rid for part in selection['sources'] for rid in part['record_ids']}
                small={rid:allrows[rid] for rid in small_ids}
                assert len(small)==214
                base,before_rdf=response(test,'base',small,refs,cutoff,tools)
                extra={**small,'D003B-T03-0001':allrows['D003B-T03-0001']}
                added,after_rdf=response(test,'unrelated',extra,refs,cutoff,tools)
                assertions += [{'name':'D004_214_plus_unrelated_KR_row','status':'pass' if base==added else 'fail'}]
            if test=='CQ07-2':
                checks_at=[('2026-09-06T11:59:59+09:00','D003B-T13-0179'),('2026-09-06T12:00:00+09:00','D006B-T13-0009'),
                           ('2026-10-07T11:59:59+09:00','D006B-T13-0009'),('2026-10-07T12:00:00+09:00','D006B-T13-0011')]
                for at,rid in checks_at:
                    selected,_=response(test,name,varied,refs,at,tools)
                    actual=selected['facts']['selected']['D003B-T13-0179']
                    assertions.append({'name':'revision_available_boundary:'+at,'status':'pass' if actual['record_id']==rid and actual['spend']==independent[rid]['spend'] else 'fail'})
            # Audit field locations and hashes, not full variant payloads.
            delta=[{'record_id':rid,'fields':sorted(p for p,v in leaves(varied[rid]) if dict(leaves(allrows.get(rid,{}))).get(p,object())!=v)} for rid in varied if varied[rid]!=allrows.get(rid)]
            removed=sorted(set(allrows)-set(varied))
            branches.append({'id':name,'end_to_end_status':verdict(assertions),'answer':out,'assertions':assertions,'RDF':rdf,
                'memory_input_sha256':data.fingerprint(varied),'memory_changes':delta,'removed_ids':removed})
        status=verdict([{'status':b['end_to_end_status']} for b in branches])
        results.append({'id':test,'end_to_end_status':status,'answer':branches[0]['answer'],'assertions':[a for b in branches for a in b['assertions']],
            'branches':branches,'scope_id':scope['scope_id'],'reason':None if status=='pass' else 'see per-branch assertion failures'})
        print(json.dumps({'test':test,'status':status,'branches':len(branches)}),file=sys.stderr,flush=True)
    faults=fault_checks(allrows,refs,tools)
    checks.append({'name':'B_memory_branches','status':verdict(faults),'cases':faults})
    changed=[p for p,h in before.items() if data.sha(data.ROOT/p)!=h]
    checks.append({'name':'input_immutability','status':'fail' if changed else 'pass','changed_inputs':changed})
    counts=Counter(t['end_to_end_status'] for t in results)
    status='fail' if counts['fail'] or any(c['status']=='fail' for c in checks) else 'not_run' if counts['not_run'] or any(c['status']=='not_run' for c in checks) else 'pass'
    return {'cycle':'D006-CQ-AB-1','status':status,'exit_code':{'pass':0,'fail':1,'not_run':2}[status],'scope_sha256':data.fingerprint(scope),
        'approval_sha256':data.sha(approval),'input_sha256':before,'checks':checks,'test_cases':results,
        'test_status_counts':{s:counts[s] for s in ['pass','fail','not_run']},'source_rows':56,'files':9,'seller_declarations':2,
        'A_mutation_branches':16,'B_memory_branches':10,'RDF_persisted':False,'system_validation':'incomplete',
        'independent_business_review':'pending_user_review','business_definition_review':'confirmed_by_user_decisions_2A_3A',
        'decision_record_sha256':data.sha(data.HERE/'meaning-decisions-20261016.json'),
        'policy_version':POLICY_VERSION,'actual_provider_fit':'not_run'}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--approval-record',type=Path,required=True);p.add_argument('--tools',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    if sys.flags.optimize:p.error('assertion checks require Python without -O')
    if args.output.exists():p.error('report overwrite refused')
    try:report=run(args.approval_record,args.tools)
    except Exception as exc:
        import traceback
        report={'cycle':'D006-CQ-AB-1','status':'not_run' if isinstance(exc,(ModuleNotFoundError,PermissionError)) else 'fail',
                'exit_code':2 if isinstance(exc,(ModuleNotFoundError,PermissionError)) else 1,'reason':str(exc),'traceback':traceback.format_exc(),'system_validation':'incomplete'}
    report['finished_at']=datetime.now(timezone.utc).isoformat();data.write_new(args.output,report)
    print(json.dumps({k:report[k] for k in ['status','exit_code']},ensure_ascii=False))
    return report['exit_code']


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8');sys.stderr.reconfigure(encoding='utf-8')
    raise SystemExit(main())
