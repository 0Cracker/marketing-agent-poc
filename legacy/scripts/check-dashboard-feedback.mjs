import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {loadCurrentData} from './current-data.mjs';
import {coverageRows,coverageMarkdown} from './report-data-coverage.mjs';
const {catalog,manifest,lock}=loadCurrentData();
const types=coverageRows(catalog,manifest),get=(t,c='KR')=>types.find(r=>r.type===t).coverage.filter(g=>g.country===c);
assert.equal(types.length,41);assert.equal(types.reduce((n,t)=>n+t.rows,0),30327);
for(const t of types)assert.equal(t.coverage.reduce((n,g)=>n+g.rows,0),t.rows);
assert.equal(get('T19')[0].start,'2026-08-03');assert.equal(get('T19')[0].end,'2026-08-30');
assert.equal(get('T26')[0].end,'2026-08-24');assert.equal(get('T26','JP')[0].end,'2026-08-27');
assert.equal(get('H01')[0].windows.length,24);assert.equal(get('H01')[0].end,'2026-09-30');
assert.equal(get('T13').length,2);assert.equal(get('T15')[0].windows.length,12);assert(get('T15')[0].missingDatesWithinRange>0);
assert.equal(get('T25')[0].start,'2026-08-03');assert.equal(get('T25')[0].end,'2026-08-30');
assert.equal(get('T01','GLOBAL')[0].mode,'validity');assert.equal(get('T39').find(g=>g.mode==='definition').start,null);
assert(!types.some(t=>t.coverage.some(g=>g.basis.includes('collected_at')||g.basis.includes('available_at'))));
const report={date:'2026-10-20',dataHash:manifest.data_sha256,rows:manifest.rows,types};
assert.equal(fs.readFileSync('docs/design/current-data-coverage.md','utf8'),coverageMarkdown(report));
const vite=await createServer({configFile:false,root:process.cwd()+'/frontend',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
try{
 const {createCurrentServices}=await vite.ssrLoadModule('/workbench/current-service.ts'),{service}=createCurrentServices(catalog,lock,manifest);
 for(const country of ['KR','JP','US']){
  const tickets=service.query('T26',country,'2026-08'),daily=tickets.charts[0],topics=tickets.charts[1];
  assert.equal(daily.kind,'line');assert.equal(daily.series.length,1);assert.equal(topics.pageSize,topics.data.length);
  for(const row of daily.data)assert.equal(row.values.v0,row.source.length);
  assert(topics.data.some(r=>r.values.name==='배송 문의'));assert.equal(topics.data.length,5);
  const ads=service.query('T10',country,'ALL').charts[0];assert(ads.caption.includes('가상'));assert.deepEqual(ads.data.map(r=>r.id),['B1','B2','B3']);assert(ads.data.every(r=>r.values.name.includes('가상')));
  const index=service.query('T33',country,'ALL');assert.equal(index.charts[0].data[0].id,'2024-10-01');assert.equal(index.charts[0].data.at(-1).id,'2026-09-01');assert(index.metrics[0].label.includes('가상'));assert.equal(index.metrics[0].source.length,1);assert(index.charts[0].caption.includes('실제 공표 통계가 아닌'));
 }
 const result={pass:true,dataHash:manifest.data_sha256,types:types.length,countryGroups:types.reduce((n,t)=>n+t.coverage.length,0),checks:['one-series daily totals','all five topics without paging','synthetic advertisers named','synthetic index limitations','41 types and all rows counted','country-specific dates','monthly/daily mixed grain','gaps retained','inherited review dates','definitions are not measurements','report matches current source']};
 fs.writeFileSync('evidence/dashboard-trends-20261020/feedback-checks.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await vite.close();}
