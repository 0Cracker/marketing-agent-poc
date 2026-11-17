"""Run against npm run dev:agent:mock, using existing approved data only.
Requires Python Playwright and Chromium. Writes screenshots and ui-results.json.
"""
import json
import math
import os
import re
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'evidence/v0.4.28/after'
checks = []
Path(__file__).with_name('ui-results.json').unlink(missing_ok=True)

def check(name, condition):
    assert condition, name
    checks.append(name)

def money(value):
    return f'{math.floor(value + .5):,}원'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE_PATH') or None, headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:5173/workbench')
    expect(page.get_by_role('heading', name='ROAS 기간별 추이')).to_be_visible()
    data = json.load(urlopen('http://127.0.0.1:5173/workbench-data/roas/training-S16-initial.json'))
    totals = page.get_by_label('ROAS 산식의 매출과 집행비')
    for period in ['baseline', 'current']:
        rows = [row for row in data['facts'] if row['periodId'] == period]
        for metric in ['revenue', 'spend']:
            expect(totals).to_contain_text(money(sum(row[metric] for row in rows)))
    check('S16 revenue and spend match independent sums for both periods', True)
    expect(page.locator('.training-indicator[aria-label="CPC"] .training-delta')).to_have_text('+12.1% 악화')
    check('CPC increase is explicitly labeled deterioration', True)
    events = page.get_by_label('추이와 연결된 운영 기록')
    expect(events.get_by_role('button')).to_have_count(3)
    expect(page.locator('.training-roas-overview .recharts-reference-line')).to_have_count(3)
    page.screenshot(path=str(OUT / 'overview-desktop.png'), full_page=True)
    page.screenshot(path=str(OUT / 'overview-desktop-viewport.png'))
    events.get_by_role('button', name='08/21').click()
    expect(page.get_by_role('dialog', name='2026-08-21 운영 기록')).to_be_visible()
    page.get_by_role('dialog').locator('summary').click()
    expect(page.get_by_role('dialog')).to_contain_text('PAYMENT_CALLBACK_TIMEOUT')
    expect(page.get_by_role('dialog')).to_contain_text('2026-08-25T00:00:00+09:00')
    page.screenshot(path=str(OUT / 'event-evidence.png'))
    page.get_by_role('button', name='근거 닫기').click()
    expect(page.get_by_role('dialog')).not_to_be_visible()
    check('Event opens original mobile payment error and closing restores overview', True)
    page.get_by_role('button', name='CVR 상세 분석', exact=True).first.click()
    hero = page.locator('.training-metric-detail .training-metric-hero')
    expect(hero.locator('.recharts-reference-line')).to_have_count(3)
    hero.get_by_role('button', name='08/21').click()
    page.get_by_role('dialog').locator('summary').click()
    expect(page.get_by_role('dialog')).to_contain_text('PAYMENT_CALLBACK_TIMEOUT')
    page.screenshot(path=str(OUT / 'cvr-event-evidence.png'))
    page.get_by_role('button', name='근거 닫기').click()
    check('CVR detail has three markers and opens the original payment error', True)
    page.get_by_label('클릭 기준 구매 CVR 분석 단위', exact=True).select_option('device')
    page.get_by_role('button', name='PC', exact=True).click()
    page.get_by_role('button', name='이 대상으로 좁혀 보기', exact=True).click()
    expect(hero.get_by_role('button', name='08/21')).to_have_count(0)
    expect(hero.locator('.recharts-reference-line')).to_have_count(2)
    check('Narrowing CVR detail to PC removes the mobile payment event', True)
    page.get_by_role('button', name='전체 기기로 보기', exact=True).click()
    page.get_by_role('button', name='성과 현황', exact=True).first.click()
    page.get_by_role('button', name='분석 대상: 전체 캠페인').click()
    page.locator('button[data-campaign="EDU-C1"]').click()
    scoped = [row for row in data['facts'] if row['campaignId'] == 'EDU-C1' and row['periodId'] == 'current']
    for metric in ['revenue', 'spend']:
        expect(totals).to_contain_text(money(sum(row[metric] for row in scoped)))
    check('Campaign selection refreshes financial amounts from selected facts', True)
    page.get_by_role('button', name=re.compile('분석 대상:')).click()
    page.get_by_role('button', name='전체 캠페인 조회', exact=True).click()
    page.get_by_role('button', name='리뷰 분석', exact=True).click()
    expect(page.get_by_role('heading', name='카테고리 기간 비교')).to_be_visible()
    changes = page.locator('.review-period-change:visible')
    expect(changes).to_have_count(5)
    check('All five review mention changes are neutral', all('training-delta-neutral' in value for value in changes.evaluate_all('(nodes)=>nodes.map(n=>n.className)')))
    expect(page.get_by_role('button', name=re.compile('배송 이전 언급률'))).to_contain_text('+4.7%p')
    page.screenshot(path=str(OUT / 'reviews-desktop.png'), full_page=True)
    page.get_by_role('button', name='성과 현황', exact=True).first.click()
    page.get_by_text('테스트 케이스', exact=True).click()
    page.get_by_label('데이터 사례', exact=True).select_option('S01')
    expect(page.locator('.training-analysis-context')).to_contain_text('S01')
    expect(page.get_by_role('heading', name='ROAS 기간별 추이')).to_be_visible()
    check('Scenario switch reloads overview without stale S16 evidence', True)
    page.get_by_label('데이터 사례', exact=True).select_option('S16')
    expect(page.locator('.training-analysis-context')).to_contain_text('S16')
    expect(page.get_by_label('추이와 연결된 운영 기록').get_by_role('button')).to_have_count(3)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(OUT / 'overview-mobile.png'), full_page=True)
    check('Mobile event titles wrap without clipping', page.locator('.training-chart-events button>span:not(.training-event-open)').evaluate_all('(nodes)=>nodes.every(n=>n.scrollWidth<=n.clientWidth)'))
    check('390x844 overview has no page overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.get_by_label('추이와 연결된 운영 기록').get_by_role('button', name='08/17').press('Enter')
    expect(page.get_by_role('dialog', name='2026-08-17 운영 기록')).to_be_visible()
    expect(page.get_by_role('dialog')).to_contain_text('7개 집계 행 또는 상세 기록')
    page.get_by_role('button', name='근거 닫기').click()
    check('Mobile keyboard activation opens date-grouped evidence', True)
    for width in [768, 1024]:
        page.set_viewport_size({'width': width, 'height': 1000})
        # Recharts updates its measured width after the breakpoint layout settles.
        expect(page.locator('html')).to_have_js_property('scrollWidth', width)
        check(f'{width}px overview has no page overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    check('No uncaught browser errors during these flows', not errors)
    browser.close()

Path(__file__).with_name('ui-results.json').write_text(json.dumps({'checks': checks, 'passed': len(checks), 'errors': errors}, ensure_ascii=False, indent=2) + '\n')
print(f'{len(checks)} browser checks passed')
