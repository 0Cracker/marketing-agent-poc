/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node script resolving the preinstalled Playwright */
// Run against `npm run dev:agent:mock` (existing approved data only).
// node evidence/v5.0.20/validation/browser-check.cjs  → screenshots in ../after, results in ui-results.json
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const OUT=path.join(__dirname,'..','after'),BASE='http://127.0.0.1:5173/workbench';
const checks=[];const check=(name,ok,detail='')=>{if(!ok)throw Error('FAILED: '+name+' '+detail);checks.push(name);};
(async()=>{
 const browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(BASE,{waitUntil:'networkidle'});
 const briefing=page.getByLabel('사례 안내와 추천 탐색 순서');
 check('Briefing shows three exploration steps',await briefing.locator('li').count()===3);
 check('Case hint stays folded by default',!(await briefing.locator('details').evaluate(d=>d.open)));
 const order=await page.$$eval('.training-secondary-metrics .training-indicator',n=>n.map(x=>x.getAttribute('aria-label')));
 check('Cards follow AOV, CVR, CPC then CTR, CPA without CAC',JSON.stringify(order)===JSON.stringify(['AOV','CVR','CPC','CTR','CPA']),JSON.stringify(order));
 check('CVR card states click basis',(await page.locator('.training-indicator[aria-label="CVR"] .training-indicator-basis').innerText())==='클릭 기준');
 const axis=await page.locator('.training-sparkline-axis').first().innerText();
 check('Small charts show start and end dates',/08\/17[\s\S]*08\/30/.test(axis),axis);
 const kpi=await page.locator('.training-roas-summary').first().evaluate(n=>[n.querySelector('.training-roas-value-row').getBoundingClientRect().top,n.querySelector('.training-roas-direction').getBoundingClientRect().top]);
 check('ROAS value appears above the comparison line',kpi[0]<kpi[1]);
 check('ROAS chart shades one incident span',await page.locator('.training-roas-overview .recharts-reference-area').count()===1);
 check('Event list states incident duration',(await page.getByLabel('추이와 연결된 운영 기록').first().innerText()).includes('08/21~08/24 지속'));
 const body=await page.locator('main').innerText();
 check('Revenue uses one term on overview',body.includes('귀속 구매 매출')&&!body.includes('구매 전환 매출'));
 await page.screenshot({path:path.join(OUT,'overview-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'CVR 상세 분석'}).first().click();await page.waitForTimeout(500);
 check('CVR detail shades the incident span',await page.locator('.training-metric-hero-chart .recharts-reference-area').count()===1);
 const funnel=await page.locator('.training-funnel').innerText();
 check('Funnel links clicks and sessions denominators',funnel.includes('클릭 28,392회')&&funnel.includes('랜딩 세션은 24,701회'),funnel.slice(0,200));
 const worst=await page.locator('.training-funnel-step.is-worst strong').innerText();
 check('Funnel marks checkout to purchase as worst step',worst.startsWith('동일 세션 구매 건수')&&worst.includes('가장 크게 나빠진 단계'),worst);
 await page.locator('.training-funnel').screenshot({path:path.join(OUT,'cvr-funnel.png')});
 await page.screenshot({path:path.join(OUT,'cvr-detail.png')});
 await page.getByRole('button',{name:'성과 현황'}).first().click();
 await page.getByRole('button',{name:'AI와 대화'}).click();await page.waitForTimeout(800);
 check('AI footnote states connected local substitute mode',(await page.locator('.wb-chat-footnote').innerText()).includes('연결됨, 로컬 대체 응답 모드'));
 await page.locator('textarea').fill('ROAS가 왜 떨어졌어?');await page.keyboard.press('Enter');
 await page.getByText('분석 과정 보기').first().waitFor({timeout:30000});
 check('Free question completes in mock mode with folded process log',true);
 await page.screenshot({path:path.join(OUT,'ai-panel.png')});
 await page.getByRole('button',{name:'닫기'}).last().click().catch(()=>{});
 await page.getByRole('button',{name:'운영 기록',exact:true}).first().click();await page.waitForTimeout(500);
 check('Record totals explain split',(await page.locator('.training-records-overall').innerText()).includes('기간 중 변경 9건 + 시작 시점 설정 24건'));
 await page.getByRole('button',{name:'리뷰 분석',exact:true}).first().click();await page.waitForTimeout(800);
 const headers=await page.$$eval('.review-table thead th',n=>n.map(x=>x.innerText.trim()));
 check('Review table hides empty link column',!headers.includes('원문 확인')&&headers.length===5,JSON.stringify(headers));
 check('Review mention changes stay neutral',(await page.locator('.review-period-change.training-delta-neutral:visible').count())===5);
 await page.getByRole('button',{name:'성과 현황',exact:true}).first().click();
 await page.getByText('테스트 케이스',{exact:true}).click();
 for(const [caseId,areas] of [['S03',0],['S18',2],['S13',1]]){
  await page.selectOption('select[aria-label="데이터 사례"]',caseId);await page.waitForTimeout(900);
  const count=await page.locator('.training-roas-overview .recharts-reference-area').count();
  check(`${caseId} shows ${areas} incident span(s)`,count===areas,String(count));
 }
 await page.selectOption('select[aria-label="데이터 사례"]','S16');await page.waitForTimeout(900);
 for(const width of [390,768,1024]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(400);
  check(`${width}px overview has no page overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
 await page.screenshot({path:path.join(OUT,'overview-mobile.png'),fullPage:true});
 check('No uncaught browser errors',errors.length===0,JSON.stringify(errors));
 await browser.close();
 fs.writeFileSync(path.join(__dirname,'ui-results.json'),JSON.stringify({checks,passed:checks.length,errors},null,2)+'\n');
 console.log(checks.length+' browser checks passed');
})().catch(e=>{console.error(e.message);process.exit(1);});
