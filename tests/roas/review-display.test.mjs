import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {reviewQuery} from '../../scripts/roas/review-data.mjs';
import {readReviewProjection} from '../../frontend/roas/review-projection.ts';

test('review initial render shows all 60/25 reviews and explicit writing dates',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
  const {default:Section}=await server.ssrLoadModule('/roas/review-analysis-section.tsx');
  for(const caseId of ['S16','S17']){
   const dto=reviewQuery({caseId});
   const html=renderToStaticMarkup(React.createElement(Section,{caseId,asOf:dto.asOf,periods:[{id:'baseline',start:'2026-08-03',end:'2026-08-17'},{id:'current',start:'2026-08-17',end:'2026-08-31'}],view:readReviewProjection(dto,caseId,dto.asOf)}));
   assert.match(html,new RegExp('조회된 리뷰</span><strong>'+(caseId==='S16'?60:25)+'건'));
   assert.match(html,/>쿠팡<\/button>/);
   assert.match(html,/리뷰 작성일 기준/);
   assert.match(html,/2026.08.03/);
   assert.match(html,/2026.08.30/);
   assert.match(html,/aria-pressed="true"[^>]*>기간 비교<\/button>/);
   assert(html.indexOf('>기간 비교</button>')<html.indexOf('>전체 분포</button>'));
   assert.doesNotMatch(html,/aria-label="리뷰 작성일 기간"/);
   assert.equal([...html.matchAll(/class="review-bar-track review-period-bar (?:before|after)"/g)].length,10);
   assert.match(html,caseId==='S16'?/언급률 <\/span>40\.7%<\/span>/ : /언급률 <\/span>\d+\.\d%<\/span>/);
   assert.match(html,caseId==='S16'?/<span>\(11\/27건\)<\/span>/ : /<span>\(\d+\/12건\)<\/span>/);
   assert.match(html,/세부 분류, 평가와 근거/);
   assert.doesNotMatch(html,/승인 데이터 총|상위 5개, 세부 18개/);
   assert.equal([...html.matchAll(/aria-expanded="false" aria-controls="review-category-detail-/g)].length,5);
   assert.match(html,/aria-label="판매처, 단일 선택"/);
   const header=html.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/)[1];
   const columns=[...header.matchAll(/<th scope="col">(.*?)<\/th>/g)].map(([,cell])=>cell.match(/aria-label="([^"]+) 정렬"/)?.[1]??cell);
   assert.deepEqual(columns,['분류 카테고리','평점','판매처','리뷰 원문','작성일','원문 확인']);
   assert.match(html,/selection-button/,'filters use the shared selection button');
  }
 }finally{await server.close();}
});
