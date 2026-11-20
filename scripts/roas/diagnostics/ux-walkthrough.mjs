// 실사용자 테스트를 대신하는 반복 가능한 화면 점검이다.
// 퍼포먼스 마케터의 대표 과업을 브라우저에서 직접 수행하고, 과업 성공 여부와 UX 점검 결과를 JSON으로 남긴다.
// 사람의 사용성 평가를 대체하지 않으며, 정해진 과업과 휴리스틱만 확인한다.
//
// 사용법: npm run build && npm run start  (다른 터미널)
//        node scripts/roas/diagnostics/ux-walkthrough.mjs [--url http://127.0.0.1:5173/workbench] [--out 폴더] [--shots]
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {chromium,devices}=require('playwright');

const args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};
const url=option('--url','http://127.0.0.1:5173/workbench');
const out=option('--out','');
const shots=args.includes('--shots');
const results=[];

function record(id,task,ok,detail){results.push({id,task,ok:Boolean(ok),detail});console.log(`${ok?'PASS':'FAIL'} ${id} ${task}${detail?' :: '+detail:''}`);}
async function step(id,task,body){
 try{const detail=await body();record(id,task,detail?.ok??true,detail?.detail??'');}
 catch(error){record(id,task,false,String(error?.message||error).split('\n')[0]);}
}
const inViewport=async(page,locator)=>{const box=await locator.boundingBox();const view=page.viewportSize();return Boolean(box&&box.y>=0&&box.y+box.height<=view.height);};

const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&!/agent-api|Failed to load resource/.test(message.text()))errors.push(message.text());});
 const started=Date.now();
 await page.goto(url,{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'성과 현황',level:1}).waitFor();
 const loadMs=Date.now()-started;
 const transfer=await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>/\.js$/.test(entry.name)).reduce((sum,entry)=>sum+(entry.encodedBodySize||0),0));

 await step('T01','첫 화면(1440×900)에서 매출, 집행비, 주문, ROAS와 목표를 스크롤 없이 확인',async()=>{
  const labels=['귀속 구매 매출','유료 마케팅 집행비','귀속 구매 주문'];
  const missing=[];
  for(const label of labels)if(!await inViewport(page,page.locator('.training-scale-kpi h3',{hasText:label})))missing.push(label);
  if(!await inViewport(page,page.locator('.training-roas-current')))missing.push('ROAS 값');
  if(!await inViewport(page,page.locator('.training-target-note')))missing.push('목표 ROAS');
  return {ok:!missing.length,detail:missing.length?'화면 밖: '+missing.join(', '):'모두 첫 화면에 표시'};
 });
 await step('T02','ROAS 추이와 같은 화면에서 분석 기간 운영 기록의 날짜 확인',async()=>{
  const items=await page.locator('.training-roas-overview .training-chart-event').allInnerTexts();
  return {ok:items.length>0&&items.every(text=>/^\d{2}\/\d{2}/.test(text)),detail:items.join(' | ')};
 });
 await step('T03','목표 ROAS 미달 캠페인 찾기',async()=>{
  await page.locator('#training-campaign-roas .training-analysis-expand').first().click();
  const below=await page.locator('#training-campaign-roas tr',{has:page.locator('.training-target-badge')}).locator('th').allInnerTexts();
  return {ok:below.length>0,detail:'목표 미달 행: '+below.map(text=>text.replace(/^[+−-]\s*/,'').trim()).join(', ')};
 });
 await step('T04','캠페인별 ROAS 표를 CSV로 내려받아 엑셀용 형식 확인',async()=>{
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#training-campaign-roas .training-csv-button').click()]);
  const text=fs.readFileSync(await download.path(),'utf8');
  const lines=text.replace(/^﻿/,'').split('\r\n');
  return {ok:text.startsWith('﻿')&&lines.length>2&&lines[0].startsWith('캠페인,구분,전체 변화 기여'),detail:`${download.suggestedFilename()}, ${lines.length-1}행`};
 });
 await step('T05','결제 실패율 카드에서 구매 퍼널로 이동',async()=>{
  await page.getByRole('button',{name:'구매 퍼널 보기 ↗'}).click();
  await page.getByRole('heading',{name:/구매 CVR 상세 분석/}).waitFor();
  const funnel=await page.locator('.training-funnel').count();
  return {ok:funnel===1,detail:'구매 CVR 상세의 퍼널 '+funnel+'개'};
 });
 await step('T06','지표 이름이 메뉴, 카드, 상세 제목에서 일치',async()=>{
  const menu=await page.locator('#training-metric-list button').allInnerTexts();
  await page.getByRole('button',{name:'성과 현황'}).first().click();
  await page.getByRole('heading',{name:'성과 현황',level:1}).waitFor();
  const cards=await page.locator('.training-indicator-title>span').allInnerTexts();
  const mismatch=menu.filter(label=>!cards.includes(label));
  return {ok:!mismatch.length,detail:mismatch.length?'카드에 없는 메뉴 이름: '+mismatch.join(', '):'메뉴 '+menu.join(', ')};
 });
 await step('T07','페이지 끝에서 AI 버튼이 마지막 콘텐츠를 가리지 않음',async()=>{
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForTimeout(200);
  const fab=await page.locator('#wb-chat-launcher').boundingBox();
  const last=await page.locator('#training-content > *').last().boundingBox();
  const overlap=Boolean(fab&&last&&fab.y<last.y+last.height&&fab.x<last.x+last.width);
  return {ok:!overlap,detail:overlap?'겹침':'마지막 콘텐츠 아래에 여백 확보'};
 });
 await step('T08','AI 서버가 없을 때 입력창이 이유를 안내하고 예시 답변은 사용 가능',async()=>{
  await page.locator('#wb-chat-launcher').click();
  const input=page.getByRole('textbox',{name:'분석 질문'});
  await input.waitFor();
  await page.waitForTimeout(1500);
  const disabled=await input.isDisabled(),placeholder=await input.getAttribute('placeholder');
  const example=page.locator('.wb-chat-starters button').first();
  const exampleEnabled=await example.isEnabled();
  await page.getByRole('button',{name:/닫기/}).first().click().catch(()=>{});
  return {ok:disabled&&/연결/.test(placeholder||'')&&exampleEnabled,detail:`입력 비활성=${disabled}, 안내="${placeholder}", 예시 사용 가능=${exampleEnabled}`};
 });
 await step('T09','18개 사례 전환 시 오류 없이 첫 화면 표시',async()=>{
  const failed=[];
  await page.goto(url,{waitUntil:'networkidle'});
  const select=page.getByLabel('데이터 사례');
  const values=await select.locator('option').evaluateAll(options=>options.map(option=>option.value));
  await page.locator('.training-test-cases summary').click();
  for(const value of values){
   await select.selectOption(value);
   await page.locator('.training-scale-kpi').first().waitFor({timeout:10000}).catch(()=>failed.push(value));
   if(await page.locator('[role=alert]').count())failed.push(value);
  }
  return {ok:!failed.length&&values.length===18,detail:`${values.length}개 사례, 실패 ${failed.join(', ')||'없음'}`};
 });
 await step('T10','이름 없는 버튼과 입력 요소 없음(스크린리더)',async()=>{
  const unnamed=await page.evaluate(()=>[...document.querySelectorAll('button,select,input,textarea,a[href]')].filter(node=>{
   const element=node;if(element.closest('[hidden]')||element.getAttribute('aria-hidden')==='true')return false;
   const label=element.getAttribute('aria-label')||element.getAttribute('title')||element.textContent?.trim()||(element.id&&document.querySelector(`label[for="${element.id}"]`)?.textContent)||element.closest('label')?.textContent;
   return !label||!label.trim();
  }).map(node=>node.outerHTML.slice(0,80)));
  return {ok:!unnamed.length,detail:unnamed.length?unnamed.join(' | '):'모두 이름 있음'};
 });
 if(shots&&out){fs.mkdirSync(out,{recursive:true});await page.goto(url,{waitUntil:'networkidle'});await page.screenshot({path:path.join(out,'desktop-overview.png'),fullPage:true});}

 const phone=await browser.newContext({...devices['iPhone 13']});
 const mobile=await phone.newPage();
 await step('T11','휴대폰(390px)에서 가로 스크롤 없이 첫 화면과 지표 상세 표시',async()=>{
  await mobile.goto(url,{waitUntil:'networkidle'});
  await mobile.getByRole('heading',{name:'성과 현황',level:1}).waitFor();
  const widths=[await mobile.evaluate(()=>document.documentElement.scrollWidth)];
  await mobile.getByRole('button',{name:'메뉴 열기'}).click();
  await mobile.locator('#training-metric-list').getByRole('button',{name:'구매 CPA 상세 분석'}).click();
  await mobile.getByRole('heading',{name:/구매 CPA 상세 분석/}).waitFor();
  widths.push(await mobile.evaluate(()=>document.documentElement.scrollWidth));
  if(shots&&out)await mobile.screenshot({path:path.join(out,'mobile-cpa.png')});
  return {ok:widths.every(width=>width<=390),detail:'문서 너비 '+widths.join(', ')+'px'};
 });
 await step('T12','콘솔 오류 없음',async()=>({ok:!errors.length,detail:errors.slice(0,3).join(' | ')||'없음'}));

 const summary={url,date:new Date().toISOString(),viewport:'1440x900, iPhone 13',loadMs,jsBytes:transfer,passed:results.filter(item=>item.ok).length,total:results.length,results};
 console.log(`\n${summary.passed}/${summary.total} 통과, 첫 화면 ${loadMs}ms, JS ${Math.round(transfer/1024)}KB(전송 기준)`);
 if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'ux-walkthrough.json'),JSON.stringify(summary,null,1)+'\n');}
 process.exitCode=summary.passed===summary.total?0:1;
}finally{await browser.close();}
