import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const batch = resolve(repo, 'docs/research/marketing-ontology/batches/D003B');
const manifest = JSON.parse(readFileSync(resolve(batch, 'manifest.json'), 'utf8'));
const data = {};
let total = 0;
let checkoutLineEndings = 0;
for (const [name, info] of Object.entries(manifest.files)) {
  const bytes = readFileSync(resolve(batch, 'source', name));
  const text = bytes.toString('utf8');
  // Windows autocrlf changes checkout bytes. Verify the manifest's declared LF format in memory.
  if (text.includes('\r\n')) checkoutLineEndings++;
  assert.equal(createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex'), info.sha256, name);
  const rows = text.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, info.records, name);
  assert(rows.every(row => row.is_synthetic === true));
  data[name.slice(0, -6)] = rows;
  total += rows.length;
}
assert.equal(total, 1652);

// Project existing fields only; no new source records, sentiment labels or predictions.
const payload = {
  products: data.T01,
  campaigns: data.T12,
  market: data.T03.map(r => [r.record_id, r.country_code, r.period_start, r.product_id, r.units_sold, Number(r.sales_value), Number(r.market_total_value)]),
  sales: data.H01.map(r => [r.record_id, r.country_code, r.period_start, r.product_id, r.gross_units, r.returned_units, Number(r.net_sales)]),
  ads: data.T13.map(r => [r.record_id, r.country_code, r.period_start, r.campaign_id, r.grain, r.series_role, r.impressions, r.clicks, r.conversions, r.spend === null ? null : Number(r.spend), r.attributed_revenue === null ? null : Number(r.attributed_revenue), r.availability]),
  prices: data.T08.map(r => [r.record_id, r.country_code, r.observed_at.slice(0, 10), r.product_id, Number(r.price), r.availability]),
  stock: data.T22.map(r => [r.record_id, r.country_code, r.observed_at.slice(0, 10), r.product_id, r.available_quantity, r.sellable_status]),
  reviews: data.T24,
  promotions: data.T09,
  changes: data.T35,
  quality: data.T36,
  sources: Object.entries(manifest.files).map(([file, info]) => ({ file, records: info.records, sha256: info.sha256 })),
};
assert.equal(Object.values(payload).slice(0, 11).reduce((n, rows) => n + rows.length, 0), total);
const jpDaily = payload.ads.filter(r => r[1] === 'JP' && r[4] === 'day' && r[3] === 'C-JP-social');
assert.equal(jpDaily.filter(r => r[11] !== 'complete').length, 2);
assert(jpDaily.filter(r => r[11] !== 'complete').every(r => r.slice(6, 11).every(v => v === null)));
for (const country of ['KR', 'JP', 'US']) {
  const market = payload.market.filter(r => r[1] === country && r[2] === '2026-08-01');
  assert.equal(market.length, 6);
  assert(market.every(r => r[6] === market[0][6]));
  assert(market.reduce((n, r) => n + r[5], 0) < market[0][6]);
}

const template = readFileSync(resolve(here, 'preview.fragment.html'), 'utf8');
assert.equal(template.split('__D003B_DATA__').length, 2);
const fragment = template.replace('__D003B_DATA__', JSON.stringify(payload).replaceAll('<', '\\u003c'));
assert(Buffer.byteLength(fragment) < 1_000_000);
for (const match of fragment.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(match[1]);
const output = resolve(process.argv[2] ?? resolve(here, 'marketing-dashboard-variants.html'));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, fragment);
// Standalone preview uses the same fragment; the in-conversation host supplies its carousel.
const standalone = `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>마케팅 대시보드 화면 초안</title><style>body{margin:0;padding:20px;background:#eef2f7}#draft-picker{display:flex;gap:8px;flex-wrap:wrap;margin:0 auto 16px;max-width:1280px;font:14px sans-serif}#draft-picker button{padding:10px 18px;background:#fff;border:1px solid #b7c5d8;border-radius:6px;cursor:pointer}#draft-picker button[aria-pressed=true]{background:#213f75;color:white}</style></head><body><nav id="draft-picker" aria-label="화면 초안 선택"></nav>${fragment}<script>const variants=[...document.querySelectorAll('[data-variant]')];const picker=document.getElementById('draft-picker');function showVariant(i){variants.forEach((v,j)=>{v.hidden=i!==j;picker.children[j].setAttribute('aria-pressed',String(i===j))})}variants.forEach((v,i)=>{const b=document.createElement('button');b.textContent=v.dataset.variant;b.type='button';b.onclick=()=>showVariant(i);picker.append(b)});showVariant(0);</script></body></html>`;
writeFileSync(resolve(here, 'preview.html'), standalone);
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(fragment), sourceRecords: total, sourceFiles: 11, checkoutCrlfFiles: checkoutLineEndings, variants: 3, tabsPerVariant: 6, checks: 'LF-normalized manifest hashes, counts, synthetic flag, null preservation, market denominator, JS syntax: pass' }, null, 2));
