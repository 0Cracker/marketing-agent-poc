"""Build a design-only field inventory from the existing catalog; read no records."""
import argparse
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
RESEARCH = HERE.parent
SCHEMA = RESEARCH / 'schemas/marketing-records.schema.json'
DICTIONARY = RESEARCH / 'field-dictionary.md'
OUTPUT = HERE / 'field-semantics.json'
COMMON = ('record_id', 'dataset_type', 'scope_id', 'scenario_id', 'is_synthetic',
          'value_origin', 'provenance', 'quality', 'temporal', 'related_record_ids')
PRIMARY = (
    'Product SourceRecord Observation Observation Observation Observation Observation Observation Promotion Event '
    'Event Campaign Observation Observation Observation Event Event Event Event Event Observation Observation Event Review '
    'Claim Claim Event Claim Event Observation Campaign Observation Observation Event Event CollectionRun Event '
    'AnalysisResult AnalysisResult Entity'
).split()
assert len(PRIMARY) == 40
CLASSES = set(re.findall(r'^m:([A-Za-z]+) rdf:type owl:Class',
                     (HERE / 'ontology.ttl').read_text(encoding='utf-8'), re.M))
HISTORICAL_MEANING = {
    'report_kind': '과거 보고의 웹 퍼널 또는 판매 구분',
    'subject_ref': '보고가 집계한 대상의 원천 참조',
    'period': '보고 값이 적용되는 측정 기간',
    'measures': '정의와 단위를 가진 보고 지표값 목록',
    'metric_definition_refs': '각 보고 지표의 정의·버전 참조',
    'reconciliation': '총액·반품·순액 등 보고 내 대사 정보',
    'detail_record_refs': '집계에 포함된 상세 원천 행 참조',
}
DESIGN_CONTEXT = {
    'T02': {'identity_key': ['external_system', 'external_value', 'country_code', 'valid_from'],
            'time': '[valid_from, valid_to_exclusive); use mapping effective at event time',
            'scope': 'external namespace + country + entity_type',
            'attribution': 'not applicable; confirmed requires mapping evidence',
            'relationships': {'entity_ref': 'entity_type discriminated target; no name join'},
            'units': 'identifier lexical; never parse numeric-looking IDs as numbers'},
    'T13': {'identity_key': ['platform', 'account_id', 'entity_level', 'entity_id', 'period', 'report_definition_ref'],
            'time': 'period + available_at + revision; resolve effective campaign settings',
            'scope': 'account + selected reporting dimensions + currency + coverage',
            'attribution': 'conversion actions + model/window + time basis + settings validity; unresolved blocks comparison',
            'relationships': {'campaign_ref': 'Campaign scoped to platform/account'},
            'units': 'metrics.* per definition; Money amount currency, no ratio averaging'},
    'T17': {'identity_key': ['provenance.system', 'site_ref', 'event_id'],
            'time': 'event_time distinct from temporal.available_at',
            'scope': 'site + consent scope; sample is not population',
            'attribution': 'traffic parameters observed, not validated ad attribution',
            'relationships': {'session_ref': 'source-scoped session or explicit null', 'page_ref': 'page or explicit null'},
            'units': 'one non-commerce event, not a person'},
    'T18': {'identity_key': ['provenance.system', 'event_id', 'item_index'],
            'time': 'event_time; purchase/refund measured independently',
            'scope': 'measurement_basis + variant mapping + event namespace',
            'attribution': 'campaign_ref only with explicit source basis; transaction join does not prove ad effect',
            'relationships': {'variant_ref': 'Variant through effective external ID map',
                              'transaction_ref': 'Order key required for purchase/refund'},
            'units': 'quantity counts items; event count deduplicates event_id; unit_price source basis required'},
    'T19': {'identity_key': ['provenance.system', 'seller_ref', 'order_id', 'line_id'],
            'time': 'ordered_at; financial/fulfilment status and available_at distinct',
            'scope': 'seller + currency + tax/discount definition; owned orders only',
            'attribution': 'transaction_ref is reconciliation key, not marketing cause',
            'relationships': {'variant_ref': 'Variant', 'order_id': 'Order not yet declared in OWL',
                              'customer_pseudo_ref': 'seller-scoped pseudonym; Customer not yet declared in OWL'},
            'units': 'quantity items; unit_price/discount/tax/line total Money; order total not repeated-summed'},
    'T20': {'identity_key': ['provenance.system', 'adjustment_id'],
            'time': 'requested_at != processed_at; status determines completed accounting',
            'scope': 'original order line + currency + adjustment kind/status',
            'attribution': 'order reconciliation only; return/refund may refer to same economic adjustment',
            'relationships': {'order_ref': 'Order not yet declared in OWL', 'order_line_ref': 'T19 record'},
            'units': 'quantity items; refund_amount Money required only for refund; no double deduction'},
    'T37': {'identity_key': ['provenance.system', 'record_id'],
            'time': 'performance rolling period vs incident_start/end; never substitute one for another',
            'scope': 'page + device + source measurement definition',
            'attribution': 'no performance-to-sales causal edge',
            'relationships': {'page_ref': 'page/origin; no inferred product link'},
            'units': 'measures per metric definition; percentile is not additive; incident duration time'},
}


def table_rows(section):
    rows = {}
    for line in section.splitlines():
        match = re.match(r'^\| ([a-z][a-z_0-9]*) \| (.*?) \| (.*?) \|(?: (.*?) \|)?(?: (.*?) \|)?$', line)
        if match:
            rows[match[1]] = {'datatype': match[2], 'requirement': match[3],
                              'meaning': match[4] or '', 'reference_target': match[5] or ''}
    return rows


def role(name, datatype):
    if name in {'record_id', 'dataset_type', 'scenario_id', 'is_synthetic', 'value_origin',
                'provenance', 'quality', 'related_record_ids'} or 'evidence' in name or name.endswith('_version'):
        return 'provenance'
    if name == 'temporal' or name == 'period' or name.endswith(('_at', '_from', '_to_exclusive', '_time')):
        return 'time'
    if name == 'scope_id' or any(part in name for part in ('country', 'region', 'coverage', 'geo_target')):
        return 'scope'
    if name.endswith(('_id', '_ref', '_refs')) or name in {'sku', 'subject_ref'}:
        return 'identity_or_reference'
    if any(part in name for part in ('text', 'description', 'claim', 'reason', 'hypothesis',
                                     'guideline', 'assumption', 'formula', 'uncertainty')):
        return 'statement'
    if datatype.startswith(('MetricValue', 'Money', 'Quantity')) or datatype in {'number', 'integer'} or \
       name.endswith(('_count', '_price', '_sales', '_revenue', '_ratio', '_rate', '_share',
                      '_quantity', '_amount', '_value', '_measures', '_metrics')):
        return 'measure_or_parameter'
    return 'attribute'


def entry(name, detail, concept, source_refs):
    datatype = detail['datatype']
    reference = detail['reference_target']
    target = reference if reference in CLASSES else concept
    return {'path': '$.' + name, 'role': role(name, datatype), 'concept': 'm:' + target,
            'datatype': datatype, 'meaning': detail['meaning'],
            'reference_target': reference,
            'time_context': name == 'temporal' or role(name, datatype) == 'time',
            'scope_context': name == 'scope_id' or role(name, datatype) == 'scope',
            'unit_contract': 'metric_definition' if datatype.startswith('MetricValue') else
                             'source_currency' if datatype.startswith('Money') else
                             'declared_unit' if datatype.startswith('Quantity') else 'not_declared',
            'source_references': source_refs,
            'status': '설계상 정의', 'source_validation': '원천 확인 대기',
            'classification_basis': 'field-name/datatype heuristic; concept is a candidate',
            'meaning_basis': 'field-dictionary.md; not vendor-confirmed',
            'review_status': 'pending_field_review',
            'unresolved_reason': '개별 원천 필드·식별키·단위·기간·시장·귀속·관계 대상의 동등성 미확인',
            'required_review': ['identity_namespace_and_key', 'source_field_path', 'unit_and_scale',
                                'measurement_and_available_time', 'market_and_coverage',
                                'account_attribution_and_validity', 'relation_target_and_cardinality']}


def build():
    schema = json.loads(SCHEMA.read_text(encoding='utf-8'))
    text = DICTIONARY.read_text(encoding='utf-8')
    common = table_rows(text.split('## 모든 유형의 공통 필드', 1)[1].split('## ', 1)[0])
    assert set(common) == set(COMMON), set(common) ^ set(COMMON)
    sections = {typ: section for typ, section in re.findall(
        r'^## (T\d{2})[^\n]*\n(.*?)(?=^## |\Z)', text, re.M | re.S)}
    assert set(sections) == {f'T{i:02}' for i in range(1, 41)}
    types = []
    for number in range(1, 41):
        typ = f'T{number:02}'
        definition = schema['$defs'][typ]
        specific = table_rows(sections[typ])
        assert set(definition['properties']) == set(COMMON) | set(specific), typ
        refs = definition['x-source-refs']
        grain = re.search(r'한 레코드의 단위: (.*?)\. 근거:', sections[typ])
        types.append({'type': typ, 'group': definition['x-group'], 'primary_concept': 'm:' + PRIMARY[number - 1],
                      'row_grain_contract': grain.group(1) if grain else '원천 확인 대기',
                      'schema_required_fields': definition.get('required', []),
                      'conditional_contract': definition.get('allOf', []),
                      'design_context_review': DESIGN_CONTEXT.get(typ, {'status': 'not_individually_reviewed'}),
                      'source_validation': 'pending' if typ not in {'T01','T03','T08','T09','T12','T13','T22','T24','T35','T36'} else 'batch_schema_only',
                      'fields': [entry(name, specific[name], PRIMARY[number - 1], refs) for name in definition['properties'] if name not in COMMON]})
    assert sum(len(item['fields']) for item in types) == 457
    historical = schema['$defs']['HistoricalReport']
    historical_rows = table_rows(text.split('## 공통 구조 HistoricalReport', 1)[1].split('## ', 1)[0])
    assert set(historical_rows) == set(historical['properties'])
    for name, meaning in HISTORICAL_MEANING.items():
        historical_rows[name]['meaning'] = meaning
    return {'version': 'MC-1.0.0-field-design', 'basis': ['field-dictionary.md', 'schemas/marketing-records.schema.json'],
            'scope': 'design inventory; not vendor mapping or instance validation',
            'review_summary': {'confirmed_vendor_fields': 0, 'individually_reviewed_fields': 0,
                               'heuristic_classifications': 474,
                               'definition_states': ['dictionary_design', 'heuristic_candidate', 'vendor_pending']},
            'common': [entry(name, common[name], 'SourceRecord', []) for name in COMMON],
            'types': types, 'historical_report': {'type': 'H01', 'primary_concept': 'm:Observation',
                'fields': [entry(name, historical_rows[name], 'Observation', []) for name in historical['properties'] if name not in COMMON]},
            'totals': {'types': 40, 'common_fields': 10, 'type_field_occurrences': 457,
                       'historical_specific_fields': len(historical['properties']) - len(COMMON)}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    content = json.dumps(build(), ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if OUTPUT.read_text(encoding='utf-8') != content:
            sys.exit('field-semantics.json differs from catalog; regenerate after reviewing meaning changes')
        print(json.dumps({'status': 'pass', 'type_fields': 457, 'marketing_records_read': 0}))
    else:
        OUTPUT.write_text(content, encoding='utf-8')
