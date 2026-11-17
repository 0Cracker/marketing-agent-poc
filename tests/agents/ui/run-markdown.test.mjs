import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const server=await createServer({server:{middlewareMode:true},appType:'custom'});
after(async()=>await server.close());
const citationModule=await server.ssrLoadModule('/roas/run-markdown.tsx');
const {RunMarkdown,cellTone,isNumericCell}=citationModule;
const render=answer=>renderToStaticMarkup(createElement(RunMarkdown,{answer}));

test('lists keep their own list elements and headings get document levels',()=>{
 const html=render('## 판단 근거\n\n- 첫째\n- 둘째\n\n1. 먼저\n2. 다음\n\n### 세부');
 assert.match(html,/<h3>판단 근거<\/h3>/);
 assert.match(html,/<ul><li>첫째<\/li><li>둘째<\/li><\/ul>/);
 assert.match(html,/<ol><li>먼저<\/li><li>다음<\/li><\/ol>/);
 assert.match(html,/<h4>세부<\/h4>/);
});

test('table labels stay on the left, numbers align right and deltas follow metric direction',()=>{
 const html=render('| 캠페인 | 현재 ROAS | 자체 증감 |\n| --- | --- | --- |\n| 검색 B | 137.0% | -161.0%p |\n| Facebook 피드 | 370.2% | +5.0%p |');
 assert.match(html,/<th scope="row">검색 B<\/th>/);
 assert.match(html,/<td class="is-numeric">137.0%<\/td>/);
 assert.match(html,/<td class="is-numeric wb-answer-change is-negative">-161.0%p<\/td>/);
 assert.match(html,/<td class="is-numeric wb-answer-change is-positive">\+5.0%p<\/td>/);
});

test('delta tone uses row, column then table metric and leaves spend neutral',()=>{
 assert.equal(cellTone('+12%','증감','CPC','지표 증감'),'negative');
 assert.equal(cellTone('-3.1%p','CVR 증감','','표'),'negative');
 assert.equal(cellTone('+29.8%','증감','집행비','ROAS 표'),'neutral');
 assert.equal(cellTone('+0.0%p','ROAS 증감','',''),'neutral');
 assert.equal(cellTone('137%','현재 ROAS','',''),undefined);
 assert.equal(cellTone('+4%','증감','무엇','설명'),'neutral');
 assert.equal(isNumericCell('1,240만 원'),true);
 assert.equal(isNumericCell('Instagram 피드'),false);
});

test('evidence tags become numbered chips, repeated tags share a number and a source list is added',()=>{
 const {collectCitations}=citationModule;
 const answer='ROAS가 하락했습니다. [근거: 캠페인별 성과 / ROAS / 전체 캠페인, 직전·현재 기간]\n\n'+
  '| 캠페인 | 현재 ROAS |\n| --- | --- |\n| 검색 B | 137% |\n\n[근거: 캠페인별 성과 / ROAS / 전체 캠페인,  직전·현재 기간]\n\n'+
  '- 결제 실패율이 올랐습니다. [근거: 일별 추이 / 결제 실패율 / 검색 B, 08.21~08.25]';
 const citations=collectCitations(answer);
 assert.equal(citations.length,2);
 assert.deepEqual(citations[1].parts,['일별 추이','결제 실패율','검색 B, 08.21~08.25']);
 const html=render(answer);
 assert.doesNotMatch(html,/\[근거:/);
 assert.equal((html.match(/class="wb-run-cite"/g)||[]).length,3);
 assert.match(html,/aria-label="근거 1: 캠페인별 성과 \/ ROAS \/ 전체 캠페인, 직전·현재 기간"/);
 assert.match(html,/<p class="wb-run-cite-line"><span>근거<\/span>/);
 assert.match(html,/<summary>참고한 자료 (<!-- -->)?2(<!-- -->)?개<\/summary>/);
 assert.match(html,/일별 추이 · 결제 실패율 · 검색 B, 08.21~08.25/);
});

test('answers without evidence tags render no chips or source list',()=>{
 const html=render('현재 ROAS는 284.7%입니다.');
 assert.doesNotMatch(html,/wb-run-cite|참고한 자료/);
});
