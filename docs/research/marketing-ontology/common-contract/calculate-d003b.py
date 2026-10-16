"""Independent Decimal source calculation for the two approved D004 questions."""
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
BASE = HERE.parent / 'batches/D003B'
manifest = json.loads((BASE / 'manifest.json').read_text(encoding='utf-8'))
selection = json.loads((HERE / 'batch-selection.json').read_text(encoding='utf-8'))
ids = {item['type']: set(item['record_ids']) for item in selection['sources']}


def source(typ):
    filename = typ + '.jsonl'
    raw = (BASE / 'source' / filename).read_bytes()
    expected = manifest['files'][filename]
    if hashlib.sha256(raw).hexdigest() != expected['sha256']:
        raise ValueError('changed source: ' + filename)
    lines = raw.decode('utf-8').splitlines()
    if len(lines) != expected['records']:
        raise ValueError('changed row count: ' + filename)
    return [row for line in lines if (row := json.loads(line))['record_id'] in ids[typ]]


def sum_field(rows, field):
    values = [Decimal(str(row[field])) for row in rows if row[field] is not None]
    return sum(values, Decimal(0))


def compare(rows, field):
    by_year = {year: [r for r in rows if r['period_start'][:4] == str(year) and
                     r['period_start'][5:7] in {'07','08','09'}] for year in (2025, 2026)}
    if any(len(part) != 3 for part in by_year.values()):
        return {'status': 'insufficient_data', 'month_counts': {str(y): len(v) for y, v in by_year.items()}}
    old, new = (sum_field(by_year[y], field) for y in (2025, 2026))
    return {'status': 'answered', '2025_Q3': str(old), '2026_Q3': str(new),
            'absolute_change': str(new - old),
            'relative_change': str((new - old) / old) if old else None}


def run():
    market = source('T03')
    own = source('H01')
    ads = source('T13')
    inventory = source('T22')
    price = source('T08')
    promotion = source('T09')
    runs = source('T36')
    p1_market = [r for r in market if r['country_code'] == 'JP' and r['product_id'] == 'P1A']
    p1_own = [r for r in own if r['country_code'] == 'JP' and r['product_id'] == 'P1A']
    jp_ads = [r for r in ads if r['country_code'] == 'JP' and r['grain'] == 'month']
    campaigns = sorted({r['campaign_id'] for r in jp_ads})
    q3 = {'P1A_market_units': compare(p1_market, 'units_sold'),
          'P1A_market_sales': compare(p1_market, 'sales_value'),
          'P1A_own_net_units': compare(p1_own, 'net_units'),
          'P1A_own_net_sales': compare(p1_own, 'net_sales'),
          'campaigns': {c: {field: compare([r for r in jp_ads if r['campaign_id'] == c], field)
                            for field in ('impressions','clicks','conversions','spend','attributed_revenue')}
                        for c in campaigns}}
    early_as_of = datetime.fromisoformat('2026-09-30T00:00:00+09:00')
    early_market = [r for r in p1_market if datetime.fromisoformat(r['available_at']) <= early_as_of]
    early_own = [r for r in p1_own if datetime.fromisoformat(r['available_at']) <= early_as_of]
    early_ads = [r for r in jp_ads if r['campaign_id'] == 'C-JP-search' and
                 datetime.fromisoformat(r['available_at']) <= early_as_of]
    early = {'as_of': early_as_of.isoformat(),
             'P1A_market_units': compare(early_market, 'units_sold'),
             'P1A_own_net_units': compare(early_own, 'net_units'),
             'C_JP_search_impressions': compare(early_ads, 'impressions')}
    if any(early[key]['status'] != 'insufficient_data' for key in early if key != 'as_of'):
        raise ValueError('early as-of exposed an incomplete Q3 as complete')
    for row in own:
        if Decimal(str(row['gross_units'])) - Decimal(str(row['returned_units'])) != Decimal(str(row['net_units'])):
            raise ValueError('own units arithmetic failed')
        if Decimal(str(row['gross_sales'])) - Decimal(str(row['returns_value'])) != Decimal(str(row['net_sales'])):
            raise ValueError('own sales arithmetic failed')
    denominator = defaultdict(set)
    for row in market:
        denominator[(row['country_code'],row['period_start'],row['coverage_text'],row['currency'])].add(row['market_total_value'])
    if any(len(values) != 1 for values in denominator.values()):
        raise ValueError('repeated denominator conflict')
    detail = [r for r in ads if r['country_code'] == 'JP' and r['grain'] == 'day' and
              '2026-08-03' <= r['period_start'] < '2026-08-31']
    stock = [r for r in inventory if r['country_code'] == 'JP' and r['product_id'] == 'P1A']
    offers = [r for r in price if r['country_code'] == 'JP']
    collection = [r for r in runs if r['country_code'] == 'JP']
    missing_days = sorted({r['period_start'] for r in detail if r['availability'] == 'missing'})
    if any(r['availability'] not in {'complete', 'missing'} for r in detail):
        raise ValueError('unexpected source availability state')
    return {'status': 'pass', 'source': 'D003B synthetic', 'q3': q3,
            'earlier_as_of': early,
            'market_denominator_unique_periods': len(denominator),
    'jp_detail': {'ad_rows': len(detail), 'present_ad_rows': sum(r['availability'] == 'complete' for r in detail),
                          'missing_ad_rows': sum(r['availability'] == 'missing' for r in detail),
                          'missing_dates': missing_days,
                          'known_impressions': str(sum_field(detail, 'impressions')),
                          'known_clicks': str(sum_field(detail, 'clicks')),
                          'known_conversions': str(sum_field(detail, 'conversions')),
                          'known_spend': str(sum_field(detail, 'spend')),
                          'known_attributed_revenue': str(sum_field(detail, 'attributed_revenue')),
                          'stock_rows': len(stock),
                          'zero_stock_rows': sum(Decimal(str(r['available_quantity'])) == 0 for r in stock),
                          'offer_rows': len(offers), 'promotion_rows': len(promotion),
                          'collection_expected': sum(r['expected_count'] for r in collection),
                          'collection_received': sum(r['received_count'] for r in collection),
                          'collection_missing': sum(r['missing_count'] for r in collection),
                          'causal_judgment': 'not_run'}}


if __name__ == '__main__':
    try:
        print(json.dumps(run(), ensure_ascii=False, indent=2))
    except Exception as exc:
        print(json.dumps({'status': 'fail', 'error': str(exc)}, ensure_ascii=False))
        sys.exit(1)
