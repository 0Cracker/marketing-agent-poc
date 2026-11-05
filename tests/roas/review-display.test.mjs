import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {reviewQuery} from '../../scripts/roas/review-data.mjs';
import {readReviewProjection} from '../../frontend/roas/review-projection.ts';

test('review initial render shows all 25 reviews and explicit writing dates',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
 try{
  const {default:Section}=await server.ssrLoadModule('/roas/review-analysis-section.tsx');
  for(const caseId of ['S16','S17']){
   const dto=reviewQuery({caseId});
   const html=renderToStaticMarkup(React.createElement(Section,{caseId,asOf:dto.asOf,periods:[{id:'baseline',start:'2026-08-03',end:'2026-08-17'},{id:'current',start:'2026-08-17',end:'2026-08-31'}],view:readReviewProjection(dto,caseId,dto.asOf)}));
   assert.match(html,/조회된 리뷰<\/span><strong>25건/);
   assert.match(html,/리뷰 작성일 기준/);
   assert.match(html,/2026.08.03/);
   assert.match(html,/2026.08.30/);
   assert.match(html,/aria-pressed="true"[^>]*>전체 기간/);
   assert.match(html,/>기간 비교<\/button>/);
   assert.doesNotMatch(html,/승인 데이터 총|상위 5개, 세부 18개/);
  }
 }finally{await server.close();}
});
