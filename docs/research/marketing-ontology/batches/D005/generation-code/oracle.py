"""Independent Decimal oracle and memory-only RDF/SHACL/readback. No JS imports."""
import hashlib
import json
from pathlib import Path
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
EXPECTED = {'T01':6,'T02':60,'T04':18,'T05':36,'T06':18,'T07':24,'T10':12,'T11':6,'T14':24,'T15':12,'T16':12,'T17':24,'T18':60,'T19':18,'T20':9,'T21':12,'T23':18,'T25':24,'T26':9,'T27':12,'T28':18,'T29':3,'T30':9,'T31':6,'T32':18,'T33':12,'T34':18,'T37':9,'T38':12,'T39':9,'T40':6}
COUNTRIES = ['KR','JP','US']
CURRENCIES = ['KRW','JPY','USD']


def key(name, profile):
    parts = name.split('_')
    return name if profile == 'A' else parts[0] + ''.join(p.title() for p in parts[1:]) if profile == 'B' else name.upper()


def select(schema, value, profile):
    if 'oneOf' in schema:
        options = [s for s in schema['oneOf'] if all('enum' not in d or value.get(key(k, profile)) in d['enum'] for k, d in s['properties'].items())]
        assert len(options) == 1, 'ambiguous oracle schema'
        return options[0]
    if 'anyOf' in schema:
        return next(s for s in schema['anyOf'] if (s.get('type') == 'null') == (value is None))
    return schema


def decode(value, schema, profile):
    schema = select(schema, value, profile)
    if value is None:
        return None
    if schema.get('type') == 'array':
        return [decode(v, schema['items'], profile) for v in value]
    if schema.get('type') != 'object':
        return value
    props = schema['properties']
    if set(props) == {'amount','currency'}:
        if profile == 'A':
            return value.copy()
        currency = value['currencyCode']
        amount = Decimal(value['value']) if profile == 'B' else Decimal(value['amountMinor']) / (100 if currency == 'USD' else 1)
        return {'amount': format(amount, '.2f'), 'currency': currency}
    lookup = {key(k, profile): k for k in props}
    assert all(k in lookup for k in value), 'oracle unknown source key'
    result = {lookup[k]: decode(v, props[lookup[k]], profile) for k, v in value.items()}
    if profile == 'C' and result.get('unit') in ('L','s'):
        result['value'] = float(Decimal(str(result['value'])) * 1000)
        result['unit'] = {'L':'ml','s':'ms'}[result['unit']]
    return result


def amt(m):
    return Decimal(m['amount'])


def instant(s):
    return datetime.fromisoformat(s.replace('Z','+00:00'))


def independent_checks(rows, complete):
    def typed(t, country=None):
        return [r for r in rows if r['metadata']['dataset_type'] == t and (country is None or r['metadata']['country_code'] == country)]
    by_id = {r['metadata']['record_id']:r for r in rows}
    assert len(by_id) == len(rows)
    parents = {t:[json.loads(line) for line in (HERE.parent/'D003B/source'/f'{t}.jsonl').read_text(encoding='utf-8').splitlines()] for t in ['T01','T12','T13','T24']}
    for t, expected in EXPECTED.items():
        records = typed(t)
        if records or complete:
            assert len(records) == expected, (t, len(records), expected)
            assert sorted(r['metadata']['record_id'] for r in records) == [f'D005-{t}-{i:04}' for i in range(1,expected+1)]
    ledger = {}
    for c, country in enumerate(COUNTRIES):
        def payload(t): return [r['payload'] for r in typed(t,country)]
        orders = payload('T19')
        if orders:
            assert len({o['order_id'] for o in orders}) == 4
            assert len({(o['order_id'],o['line_id']) for o in orders}) == 6
            assert sum(o['quantity'] for o in orders) == 8
            for o in orders:
                assert amt(o['unit_price'])*o['quantity']-amt(o['line_discount'])+amt(o['line_tax']) == amt(o['line_gross_total'])
                assert all(o[k]['currency'] == CURRENCIES[c] for k in ['unit_price','line_discount','line_tax','line_gross_total'])
            refunds = [r for r in payload('T20') if r['status'] == 'completed']
            pending = [r for r in payload('T20') if r['status'] == 'pending']
            assert len(refunds) == 2 and sum(r['quantity'] for r in refunds) == 2
            assert len(pending) == 1 and 'refund_amount' not in pending[0] and 'processed_at' not in pending[0]
            gross = sum(amt(o['line_gross_total']) for o in orders)
            refunded = sum(amt(r['refund_amount']) for r in refunds)
            expected = [('99000.00','24500.00','74500.00'),('9900.00','2450.00','7450.00'),('99.00','24.50','74.50')][c]
            assert (gross,refunded,gross-refunded) == tuple(Decimal(x) for x in expected)
            ledger[country] = {'currency':CURRENCIES[c], 'orders':4,'lines':6,'gross':format(gross,'.2f'),'refund':format(refunded,'.2f'),'net':format(gross-refunded,'.2f')}
            events = payload('T18')
            purchases = [e for e in events if e['event_name'] == 'purchase']
            assert len(events) == 20 and len({e['event_id'] for e in events}) == 18
            assert len(purchases) == 6 and len({e['event_id'] for e in purchases}) == 4
            assert sum(e['quantity'] for e in purchases) == 8
            assert len({e['event_id'] for e in purchases if e['session_ref'] is not None}) == 3
            assert len({e['event_id'] for e in purchases if e['session_ref'] is None}) == 1
            assert sum(amt(e['unit_price'])*e['quantity'] for e in purchases) == gross
            assert sum(amt(e['refund_amount']) for e in events if e['event_name'] == 'refund') == refunded
            general = payload('T17')
            assert len(general) == 8 and len({e['event_id'] for e in general}) == 8
            assert not {e['event_id'] for e in general} & {e['event_id'] for e in events}
            for e in general:
                if e['session_ref'].endswith(('S4','S6')): assert e['consent_state'] == 'denied'
            performance = payload('T37')
            assert sum(x['record_kind'] == 'incident' for x in performance) == 1
            for x in performance:
                if x['record_kind'] == 'performance':
                    assert (datetime.fromisoformat(x['period']['end'])-datetime.fromisoformat(x['period']['start'])).days == 28
                    assert x['measures'][0]['value'] in (2500,2600) and x['measures'][0]['unit'] == 'ms'
                else: assert (instant(x['incident_end'])-instant(x['incident_start'])).total_seconds() == 1200
        for row in typed('T25',country):
            x=row['payload']
            if x['record_kind'] == 'annotation':
                review=next(p for p in parents['T24'] if p['record_id'] == x['review_ref'])
                s=x['evidence_span']; assert review['body_text'][s['start']:s['end']] == s['quote']
                assert review['product_id'] == x['product_ref'] and review['country_code'] == country
            else: assert x['sample_size'] == 2 and x['mention_count'] == 1 and len(x['review_refs']) == 2
        for x in payload('T04'):
            b=int(x['subject_ref'][1:])-1;y=int(x['period']['start'][:4])-2025
            n=20+5*b+2*c+y
            assert x['positive_responses'] == n and x['sample_size'] == 100 and Decimal(str(x['positive_rate'])) == Decimal(n)/100
        for x in payload('T06'):
            k=['샴푸','세정','보습'].index(x['keyword']);m=int(x['period']['start'][5:7])-7
            assert x['estimated_searches'] == 1000+100*k+10*c+50*m
        for x in payload('T07'):
            p=int(x['page_ref'][-1])-1;d=int(x['period']['start'][-2:])-3
            assert x['impressions'] == 1000+100*p+10*c+50*d and x['clicks'] == 100+10*p+2*d and x['average_position'] == 5+p
            assert (x['query'] is None) == (c==1 and p==1 and d==3)
        for x in payload('T32'):
            b=int(x['subject_ref'][1:])-1;i=0 if x['period']['start']=='2026-08-03' else 1
            assert x['positive_responses'] == 20+b+5*i and x['sample_size']==50
        for row in typed('T33',country):
            x=row['payload'];m=int(x['period']['start'][5:7])-7
            assert x['value'] == 1000+100*c+10*m+5*x['revision']
            assert instant(row['metadata']['available_at']).day == (10 if x['revision'] else 5)
        for x in payload('T34'):
            if x['record_kind']=='weather':
                d=int(x['period']['start'][-2:])-3
                assert x['temperature']=={'value':25+c+d,'unit':'℃'} and x['precipitation']=={'value':d,'unit':'mm'}
        if payload('T30'):
            cohorts=[x for x in payload('T30') if x['record_kind']=='cohort']
            assert sum(amt(x['net_revenue']) for x in cohorts)==Decimal(ledger[country]['net'])
            assert all(x['sample_size']==len(set(x['customer_set']))==2 for x in cohorts)
        for x in payload('T38'):
            i=int(x['experiment_id'][-1]);a=x['arm_id']=='treatment'
            assert x['sample_size']==100 and x['conversions']==[[10,12],[20,18]][i][a]
        for x in payload('T39'):
            if x['record_kind']=='budget_candidate':
                s=[Decimal(1000),Decimal(100),Decimal(1)][c]
                assert amt(x['allocations']['search'])+amt(x['allocations']['social'])==amt(x['total_budget'])==100*s
                prediction=amt(x['allocations']['search'])/(10*s)+amt(x['allocations']['social'])/(20*s)
                assert prediction==Decimal(str(x['predicted_conversions'])) and prediction in (7,8)
    for parent in parents['T13']:
        children=[r['payload'] for r in rows if r['metadata']['dataset_type']=='T14' and r['payload']['parent_record_id']==parent['record_id']]
        if children:
            assert len(children)==2
            for k in ['impressions','clicks','conversions']: assert sum(x['metrics'][k] for x in children)==parent[k]
            for k in ['spend','attributed_revenue']: assert sum(amt(x['metrics'][k]) for x in children)==Decimal(parent[k])
    return ledger, parents


def rdf_check(common, raw, schemas, parents, source_text):
    from rdflib import Graph, Namespace, URIRef, Literal, RDF, RDFS, OWL, XSD
    from pyshacl import validate
    D=Namespace('urn:d005:');F=Namespace('urn:d005:field:');SH=Namespace('http://www.w3.org/ns/shacl#')
    g=Graph();shapes=Graph();ontology=Graph()
    classes=['Record','Product','Brand','Variant','Category','Order','OrderLine','Transaction','Session','Site','Page','Campaign','Review','Content','Comment','Cohort','Model','Policy','KPIDefinition','Region','NormalizationScope','Station']
    for cls in classes: ontology.add((D[cls],RDF.type,OWL.Class))
    registry={}
    def entity(value, cls):
        node=D['entity/'+quote(value,safe='')];registry[(cls,value)]=node;g.add((node,RDF.type,D[cls]));return node
    for p in parents['T01']:
        entity(p['product_id'],'Product');entity(p['brand_id'],'Brand')
    for p in parents['T12']: entity(p['campaign_id'],'Campaign')
    for p in parents['T24']: entity(p['record_id'],'Review')
    entity('D005-CAT-shampoo','Category');entity('D005-KPI-conversions','KPIDefinition')
    for country in COUNTRIES:
        entity(country,'Region');entity(f'D005-{country}-SITE','Site');entity(f'D005-{country}-STATION','Station')
        for i in (1,2):entity(f'D005-{country}-PAGE{i}','Page')
        for scope in ('A','B'):entity(f'D005-{country}-NORM{scope}','NormalizationScope')
    declarations={'T01':('variant_id','Variant'),'T17':('session_ref','Session'),'T19':('order_id','Order'),'T27':('content_id','Content'),'T28':('comment_id','Comment'),'T30':('cohort_ref','Cohort'),'T39':('model_id','Model'),'T40':('policy_id','Policy')}
    for row in common:
        t=row['metadata']['dataset_type'];x=row['payload']
        if t in declarations:
            field,cls=declarations[t]
            if field in x: entity(x[field],cls)
        if t=='T19':entity(x['order_id']+'/'+x['line_id'],'OrderLine');entity(x['transaction_ref'],'Transaction')
    refs={'variant_ref':'Variant','entity_ref':'Variant','product_ref':'Product','product_refs':'Product','campaign_ref':'Campaign','order_ref':'Order','order_refs':'Order','linked_orders':'Order','order_line_ref':'OrderLine','transaction_ref':'Transaction','session_ref':'Session','site_ref':'Site','page_ref':'Page','content_ref':'Content','content_refs':'Content','parent_comment_ref':'Comment','review_ref':'Review','review_refs':'Review','cohort_ref':'Cohort','model_ref':'Model','policy_ref':'Policy','kpi_definition_ref':'KPIDefinition','subject_ref':'Brand','subject_refs':'Product','advertiser_ref':'Brand','normalization_scope':'NormalizationScope','region_ref':'Region','station_ref':'Station'}
    # Every tree node has a deterministic URI. Literals keep original lexical forms.
    def put(value, uri):
        if isinstance(value,dict):
            g.add((uri,D.kind,Literal('object')))
            for k,v in value.items():g.add((uri,F[k],put(v,URIRef(str(uri)+'/'+quote(k,safe='')))))
            return uri
        if isinstance(value,list):
            g.add((uri,D.kind,Literal('array')));g.add((uri,D.length,Literal(len(value),datatype=XSD.integer)))
            for i,v in enumerate(value):g.add((uri,F[str(i)],put(v,URIRef(str(uri)+'/'+str(i)))))
            return uri
        if value is None: return D.Null
        if isinstance(value,bool):return Literal('true' if value else 'false',datatype=XSD.boolean,normalize=False)
        if isinstance(value,int):return Literal(str(value),datatype=XSD.integer,normalize=False)
        if isinstance(value,float):return Literal(str(value),datatype=XSD.double,normalize=False)
        return Literal(value,datatype=XSD.string,normalize=False)
    def get(node):
        if node==D.Null:return None
        if isinstance(node,Literal):return node.toPython()
        kind=str(g.value(node,D.kind))
        if kind=='array':return [get(g.value(node,F[str(i)])) for i in range(int(g.value(node,D.length)))]
        assert kind=='object', 'RDF missing node'
        return {str(pred)[len(str(F)):]:get(obj) for pred,obj in g.predicate_objects(node) if str(pred).startswith(str(F))}
    def flatten(v, prefix=''):
        if isinstance(v,dict):
            for k,x in v.items():yield from flatten(x,prefix+'/'+k)
        elif isinstance(v,list):
            for i,x in enumerate(v):yield from flatten(x,prefix+'/'+str(i))
        else:yield prefix,v
    raw_by_id={r['metadata']['record_id']:r for r in raw}
    source_bytes={t:source_text[t].encode('utf-8') for t in {r['metadata']['dataset_type'] for r in raw}}
    for t,b in source_bytes.items():
        parsed=[json.loads(line) for line in b.decode().splitlines()]
        assert {r['metadata']['record_id']:r for r in parsed}=={r['metadata']['record_id']:r for r in raw if r['metadata']['dataset_type']==t}
        assert all(int(r['metadata']['record_id'][-4:])==i for i,r in enumerate(parsed,1)), 'source line/id mismatch'
    # During a generation gate the stage files already exist; validate never writes them.
    source_hash={t:hashlib.sha256(b).hexdigest() for t,b in source_bytes.items() if b is not None}
    lineages=0;relations=0
    for row in sorted(common,key=lambda r:r['metadata']['record_id']):
        rid=row['metadata']['record_id'];t=row['metadata']['dataset_type'];node=D['record/'+rid]
        g.add((node,RDF.type,D.Record));tree=put(row,D['tree/'+rid]);g.add((node,D.tree,tree))
        g.add((node,D.sourceFile,Literal(row['metadata']['source_file'])));g.add((node,D.sourceHash,Literal(source_hash[t])));g.add((node,D.sourceLine,Literal(int(rid[-4:]),datatype=XSD.integer)))
        for field,cls in refs.items():
            if field in row['payload']:
                values=row['payload'][field];values=values if isinstance(values,list) else [values]
                for v in values:
                    if v is None:continue
                    assert (cls,v) in registry, ('undeclared reference',rid,field,cls,v)
                    pred=D['relation/'+field];g.add((node,pred,registry[(cls,v)]));relations+=1
        raw_row=raw_by_id[rid]
        for location,value in flatten(raw_row):
            lin=D['lineage/'+rid+quote(location,safe='')];g.add((node,D.lineage,lin));g.add((lin,D.sourcePath,Literal(location)));g.add((lin,D.sourceLexical,Literal(json.dumps(value,ensure_ascii=False,separators=(',',':')))));lineages+=1
        # Source/canonical field mapping is recorded for every canonical leaf.
        for location,value in flatten(row):
            lin=D['canonical/'+rid+quote(location,safe='')];g.add((node,D.canonicalField,lin));g.add((lin,D.commonPath,Literal(location)));g.add((lin,D.commonLexical,Literal(json.dumps(value,ensure_ascii=False,separators=(',',':')))))
            parts=location.split('/')[1:];cursor=raw_row;source_parts=[]
            for part in parts:
                if isinstance(cursor,list):mapped=part;cursor=cursor[int(part)]
                else:
                    if source_parts and source_parts[0]=='payload':
                        if part in ('amount','currency') and 'currencyCode' in cursor:
                            mapped='currencyCode' if part=='currency' else ('value' if raw_row['source_profile']=='B' else 'amountMinor')
                        else:mapped=key(part,raw_row['source_profile'])
                    else:mapped=part
                    cursor=cursor[mapped]
                source_parts.append(mapped)
            source_location='/'+'/'.join(source_parts)
            g.add((lin,D.derivedFrom,D['lineage/'+rid+quote(source_location,safe='')]))
    shape=D.RecordShape;shapes.add((shape,RDF.type,SH.NodeShape));shapes.add((shape,SH.targetClass,D.Record))
    for name in ['tree','sourceFile','sourceHash','sourceLine']:
        ps=D['shape/'+name];shapes.add((shape,SH.property,ps));shapes.add((ps,SH.path,D[name]));shapes.add((ps,SH.minCount,Literal(1)));shapes.add((ps,SH.maxCount,Literal(1)))
    for field,cls in refs.items():
        ps=D['shape/ref/'+field];shapes.add((shape,SH.property,ps));shapes.add((ps,SH.path,D['relation/'+field]));shapes.add((ps,SH['class'],D[cls]))
    for row in common:
        rid=row['metadata']['record_id'];t=row['metadata']['dataset_type'];payload_node=D['tree/'+rid+'/payload']
        schema=select(schemas[t],row['payload'],'A');signature=t+'-'+hashlib.sha256(json.dumps(schema,sort_keys=True).encode()).hexdigest()[:12]
        cls=D['Payload/'+signature];g.add((payload_node,RDF.type,cls));ontology.add((cls,RDF.type,OWL.Class))
        ns=D['shape/'+signature];shapes.add((ns,RDF.type,SH.NodeShape));shapes.add((ns,SH.targetClass,cls))
        for field in schema['required']:
            ps=D['shape/'+signature+'/'+field];shapes.add((ns,SH.property,ps));shapes.add((ps,SH.path,F[field]));shapes.add((ps,SH.minCount,Literal(1)));shapes.add((ps,SH.maxCount,Literal(1)))
    conforms, report_graph, report_text=validate(g,shacl_graph=shapes,ont_graph=ontology,inference='none',allow_infos=False,allow_warnings=False)
    assert conforms, report_text[:3000]
    for row in common:
        rid=row['metadata']['record_id'];node=D['record/'+rid]
        actual=get(g.value(node,D.tree));assert actual==row, ('RDF readback mismatch',rid)
        assert str(g.value(node,D.sourceHash))==source_hash[row['metadata']['dataset_type']]
        assert int(g.value(node,D.sourceLine))==int(rid[-4:])
        source={str(g.value(l,D.sourcePath)):str(g.value(l,D.sourceLexical)) for l in g.objects(node,D.lineage)}
        assert source=={p:json.dumps(v,ensure_ascii=False,separators=(',',':')) for p,v in flatten(raw_by_id[rid])}
        canonical={str(g.value(l,D.commonPath)):str(g.value(l,D.commonLexical)) for l in g.objects(node,D.canonicalField)}
        assert canonical=={p:json.dumps(v,ensure_ascii=False,separators=(',',':')) for p,v in flatten(row)}
        for lin in g.objects(node,D.canonicalField):
            origin=g.value(lin,D.derivedFrom);assert origin in set(g.objects(node,D.lineage))
            assert str(g.value(origin,D.sourcePath)) in source
        for field,cls in refs.items():
            values=row['payload'].get(field,[]);values=values if isinstance(values,list) else [values]
            expected={registry[(cls,v)] for v in values if v is not None}
            assert set(g.objects(node,D['relation/'+field]))==expected
            assert all((target,RDF.type,D[cls]) in g for target in expected)
        for location,value in flatten(row):
            if isinstance(value,str):
                path_parts=location.split('/')[1:];owner=D['tree/'+rid+''.join('/'+quote(k,safe='') for k in path_parts[:-1])]
                lit=g.value(owner,F[path_parts[-1]])
                assert isinstance(lit,Literal) and str(lit)==value and lit.datatype==XSD.string, (rid,location,'lexical')
    digest=hashlib.sha256('\n'.join(sorted(' '.join(n.n3() for n in triple) for triple in g)).encode()).hexdigest()
    return {'status':'pass','triples':len(g),'rdf_sha256':digest,'records_read_back':len(common),'source_field_lineages':lineages,'typed_relations':relations,'declared_classes':len(set(ontology.subjects(RDF.type,OWL.Class))),'shacl':'pass','readback':'pass'}


def main():
    request=json.load(sys.stdin)
    sys.path.insert(0,request['tools'])
    common_schema=json.loads((HERE/'common.schema.json').read_text(encoding='utf-8'))
    schemas={branch['properties']['metadata']['properties']['dataset_type']['enum'][0]:branch['properties']['payload'] for branch in common_schema['oneOf']}
    raw=request['source']
    oracle=[{'metadata':r['metadata'].copy(),'payload':decode(r['payload'],schemas[r['metadata']['dataset_type']],r['source_profile'])} for r in raw]
    actual={r['metadata']['record_id']:r for r in request['common']}
    assert {r['metadata']['record_id']:r for r in oracle}==actual, 'source oracle/common mismatch'
    ledger,parents=independent_checks(oracle,request.get('complete',False))
    rdf=rdf_check(request['common'],raw,schemas,parents,request['source_text'])
    print(json.dumps({'status':'pass','python':sys.version.split()[0],'oracle_rows':len(oracle),'money_tolerance':'0','ledger':ledger,'rdf':rdf},ensure_ascii=False))


if __name__=='__main__':
    try: main()
    except ImportError as exc:
        print(json.dumps({'status':'not_run','error':str(exc)}));sys.exit(2)
    except Exception as exc:
        import traceback
        print(json.dumps({'status':'fail','error':str(exc),'traceback':traceback.format_exc()}));sys.exit(1)
