import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const server=await createServer({server:{middlewareMode:true},appType:'custom'});
after(async()=>await server.close());
const {RunMarkdown,cellTone,isNumericCell}=await server.ssrLoadModule('/roas/run-markdown.tsx');
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
