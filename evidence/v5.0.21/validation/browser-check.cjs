/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node script resolving the preinstalled Playwright */
// Run against `npm run dev:agent:mock`. Checks the target ROAS display added in v5.0.21.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const OUT=path.join(__dirname,'..','after'),checks=[];
const check=(name,ok,detail='')=>{if(!ok)throw Error('FAILED: '+name+' '+detail);checks.push(name);};
(async()=>{
 const browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/workbench',{waitUntil:'networkidle'});
 const target=await page.locator('.training-roas-target').innerText();
 check('S16 card shows -65.3%p below the 350% target',target.includes('목표 ROAS 350.0% 대비')&&target.includes('-65.3%p, 목표 미달'),target);
 check('ROAS chart draws the target line',(await page.locator('.training-roas-overview .recharts-reference-line-line[stroke="#C2410C"]').count())===1);
 await page.locator('.training-overview-hero').screenshot({path:path.join(OUT,'roas-target.png')});
 await page.getByText('테스트 케이스',{exact:true}).click();
 await page.selectOption('select[aria-label="데이터 사례"]','S04');await page.waitForTimeout(900);
 const s04=await page.locator('.training-roas-target').innerText();
 check('S04 card shows target achieved',s04.includes('+210.0%p, 목표 달성'),s04);
 await page.getByRole('button',{name:'CVR 상세 분석'}).first().click();await page.waitForTimeout(500);
 check('Non-ROAS detail has no target line',(await page.locator('.training-metric-hero-chart .recharts-reference-line-line[stroke="#C2410C"]').count())===0);
 check('No uncaught browser errors',errors.length===0,JSON.stringify(errors));
 await browser.close();
 fs.writeFileSync(path.join(__dirname,'ui-results.json'),JSON.stringify({checks,passed:checks.length,errors},null,2)+'\n');
 console.log(checks.length+' browser checks passed');
})().catch(e=>{console.error(e.message);process.exit(1);});
