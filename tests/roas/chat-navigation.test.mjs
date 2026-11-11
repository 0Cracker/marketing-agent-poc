import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=()=>fs.readFileSync(new URL('../../frontend/roas/training-dashboard.tsx',import.meta.url),'utf8');

test('review navigation preserves the common chat launcher and an open conversation',()=>{
 const ui=source();
 const launcher=ui.slice(ui.indexOf('{active&&!chatOpen'),ui.indexOf('id="wb-chat-launcher"'));
 const panel=ui.slice(ui.indexOf('{active&&chatOpen'),ui.indexOf('<RoasConversation key='));
 assert(!launcher.includes('!reviewPage'),'review page must expose the common launcher');
 assert(!panel.includes('!reviewPage'),'review page must expose the open chat panel');
 assert(!ui.includes('if(showReview)setChatOpen(false)'),'navigation must preserve the open panel');
 assert(ui.includes("screenTitle={recordsPage?'운영 기록':reviewPage?'리뷰 분석':"),'the chat identifies both records and review pages');
});
