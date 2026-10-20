"""Explicit typed field projection, shared SHACL, and lossless RDF readback.

Values are queried from field triples, never copied from sourceContext.
JSON leaf lexical/type metadata retains explicit null and integer/string identity.
"""
from datetime import datetime, timedelta
from decimal import Decimal
import hashlib
import json
from urllib.parse import quote

from d006_data import HERE, ROOT, VERSION, fingerprint, stable


def leaves(value, path='$'):
    if isinstance(value, dict):
        for k, v in value.items():
            yield from leaves(v, path + '.' + k)
    elif isinstance(value, list):
        if not value:
            yield path, value
        for i, v in enumerate(value):
            yield from leaves(v, path + '.' + str(i))
    else:
        yield path, value


def project(rows, refs, tools, validate=True, *, include_graph=False):
    import sys
    sys.path.insert(0, str(tools))
    from rdflib import Graph, Literal, Namespace, RDF, XSD
    from pyshacl import validate as shacl
    g, m, d = Graph(), Namespace('https://example.org/marketing/'), Namespace('https://example.org/marketing/d006/')
    def iri(kind, key):
        return d[kind + '/' + quote(str(key), safe='')]
    def add(node, prop, value, datatype=None):
        g.add((node, m[prop], Literal(value, datatype=datatype)))
    transform = iri('Transformation', VERSION)
    g.add((transform, RDF.type, m.Transformation))
    add(transform, 'mappingVersion', VERSION)
    add(transform, 'codeVersion', VERSION)
    for rid, r in sorted(rows.items()):
        ref = refs[rid]
        src = iri('SourceRecord', rid)
        artifact = iri('SourceArtifact', ref['file'])
        g.add((src, RDF.type, m.SourceRecord))
        g.add((artifact, RDF.type, m.SourceArtifact))
        g.add((src, m.artifact, artifact))
        add(artifact, 'path', ref['file'])
        add(artifact, 'sha256', ref['sha256'])
        add(src, 'recordId', rid)
        add(src, 'identifierNamespace', r.get('scenario_id', 'D003B'))
        add(src, 'sourceLine', ref['line'], XSD.integer)
        add(src, 'availableAt', r['available_at'], XSD.dateTime)
        add(src, 'revision', r.get('revision', 0), XSD.integer)
        for path, value in leaves(r):
            node = iri('Field', rid + path)
            g.add((src, d.field, node))
            g.add((node, RDF.type, d.Field))
            g.add((node, d.path, Literal(path)))
            g.add((node, d.lexical, Literal(stable(value))))
            # Actual numeric field triples coexist with lexical values and are
            # independently checked below; JSON is not the numeric query path.
            if type(value) in (int, float) or isinstance(value, Decimal):
                g.add((node, d.number, Literal(str(value), datatype=XSD.decimal)))
        if r.get('target_dataset') == 'T24' or 'received_count' in r:
            run = iri('CollectionRun', rid)
            g.add((run, RDF.type, m.CollectionRun))
            for a, b in [('expected_count','expectedCount'),('received_count','receivedCount'),('missing_count','missingCount')]:
                add(run, b, r[a], XSD.integer)
            if r.get('seller_id'):
                seller=iri('Seller',r['seller_id'])
                g.add((seller,RDF.type,m.Seller)); g.add((seller,RDF.type,m.Subject))
                g.add((seller,m.sourceRecord,src)); g.add((seller,m.generatedBy,transform))
                add(seller,'sourceId',r['seller_id']); add(seller,'identifierNamespace',r.get('scenario_id','D003B'))
                g.add((run,d.seller,seller))
        if 'body_text' in r and 'review_id' in r:
            review = iri('Review', rid)
            subject = iri('Subject', r['product_id'])
            scope = iri('MarketScope', r.get('scope_id', 'D003B-' + r['country_code']))
            interval = iri('TimeInterval', str(scope))
            # Equal offset timestamps may belong to distinct reporting calendars.
            instant = iri('TimeInstant', r['written_at'] + '|' + r['reporting_timezone'])
            for node, cls in [(review,m.Review),(subject,m.Subject),(scope,m.MarketScope),(interval,m.TimeInterval),(instant,m.TimeInstant)]:
                g.add((node, RDF.type, cls))
            for node in [review,scope]:
                g.add((node, m.sourceRecord, src)); g.add((node, m.generatedBy, transform))
            g.add((review, m.subject, subject)); g.add((review,m.scope,scope)); g.add((review,m.instant,instant))
            add(review,'bodyText',r['body_text']); add(review,'language',r['language'])
            add(scope,'country',r['country_code']); add(scope,'category','샴푸'); add(scope,'coverageText','approved synthetic review sample')
            g.add((scope,m.validInterval,interval))
            add(interval,'startDate','2024-10-01',XSD.date); add(interval,'endDateExclusive','2026-10-06',XSD.date)
            add(interval,'timezone',r['reporting_timezone']); add(interval,'calendar','gregorian'); add(interval,'grain','scope')
            add(instant,'timestamp',r['written_at'],XSD.dateTime); add(instant,'timezone',r['reporting_timezone'])
        if 'evidence_span' in r:
            span = iri('EvidenceSpan', rid)
            g.add((span,RDF.type,m.EvidenceSpan)); g.add((span,m.sourceRecord,src)); g.add((span,m.generatedBy,transform))
            g.add((span,m.originalReview,iri('Review',r['review_ref'])))
            add(span,'quote',r['evidence_span']['quote']); add(span,'offsetStart',r['evidence_span']['start'],XSD.integer); add(span,'offsetEnd',r['evidence_span']['end'],XSD.integer)
            claim=iri('Claim',rid)
            g.add((claim,RDF.type,m.Claim)); g.add((claim,RDF.type,d.AspectClaim))
            g.add((claim,m.sourceRecord,src)); g.add((claim,m.generatedBy,transform)); g.add((claim,m.evidenceSpan,span))
            add(claim,'claimText',r['evidence_span']['quote']); add(claim,'originKind','provided_annotation')
            g.add((claim,d.aspect,Literal(r['aspect']))); g.add((claim,d.sentiment,Literal(r['sentiment'])))
    shapes = Graph().parse(HERE/'shapes.ttl',format='turtle')
    shapes.parse(data='''@prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix d: <https://example.org/marketing/d006/> .
      d:FieldShape a sh:NodeShape; sh:targetClass d:Field;
        sh:property [sh:path d:path; sh:minCount 1; sh:maxCount 1; sh:datatype xsd:string];
        sh:property [sh:path d:lexical; sh:minCount 1; sh:maxCount 1; sh:datatype xsd:string];
        sh:property [sh:path d:number; sh:maxCount 1; sh:datatype xsd:decimal].
      d:AspectClaimShape a sh:NodeShape; sh:targetClass d:AspectClaim;
        sh:property [sh:path d:aspect; sh:minCount 1; sh:maxCount 1; sh:in ("향" "거품" "건조감")];
        sh:property [sh:path d:sentiment; sh:minCount 1; sh:maxCount 1; sh:in ("positive" "negative")].''',format='turtle')
    if validate:
        conforms, _, detail = shacl(g,shacl_graph=shapes,advanced=True)
        if not conforms:
            raise ValueError('SHACL: ' + str(detail)[:1800])
    # Reconstruct each record only from actual field nodes after SHACL.
    readback = {}
    for src in g.subjects(RDF.type,m.SourceRecord):
        rid = str(g.value(src,m.recordId))
        flat = {}
        for node in g.objects(src,d.field):
            path = str(g.value(node,d.path))
            value = json.loads(str(g.value(node,d.lexical)))
            numeric = g.value(node,d.number)
            if type(value) in (int,float):
                if numeric is None or Decimal(str(numeric)) != Decimal(str(value)):
                    raise ValueError('numeric RDF readback mismatch')
                value = int(numeric) if type(value) is int else float(numeric)
            flat[path] = value
        out = {}
        for path,value in sorted(flat.items(),key=lambda x:len(x[0])):
            keys=path[2:].split('.')
            target=out
            for i,key in enumerate(keys[:-1]):
                next_key=keys[i+1]
                if isinstance(target,list):
                    while len(target)<=int(key):target.append({})
                    target=target[int(key)]
                else:
                    target=target.setdefault(key,[] if next_key.isdigit() else {})
            key=keys[-1]
            if isinstance(target,list):
                while len(target)<=int(key):target.append(None)
                target[int(key)]=value
            else:target[key]=value
        if out!=rows[rid]:raise ValueError('all-field RDF readback mismatch: '+rid)
        readback[rid]=out
    graph_hash=hashlib.sha256('\n'.join(sorted(' '.join(t.n3() for t in triple) for triple in g)).encode()).hexdigest()
    if include_graph:
        return g
    return readback, {'conforms':True if validate else None,'records':len(readback),'triples':len(g),'sha256':graph_hash,'fields':sum(1 for _ in g.subjects(RDF.type,d.Field))}
