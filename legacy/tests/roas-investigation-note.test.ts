import test from 'node:test';
import assert from 'node:assert/strict';
import {readInvestigation,readInvestigationStrict,connectInvestigationAction,validateInvestigationReview,updateInvestigation,freeInvestigationNote,replaceFreeInvestigationNote,recoverInvestigation} from '../frontend/workbench/roas-investigation-note.ts';

test('old free-form notes retain bytes and have the default scope',()=>{
 const note='근거: 기존 담당자 메모\r\n재검토 조건: 자료 대조\r\n  ';
 assert.deepEqual(readInvestigation(note),{channel:'all',device:'all',stage:'all',hypothesis:'none',rationale:'',condition:''});
 const updated=updateInvestigation(note,{channel:'social',device:'desktop',stage:'checkout',hypothesis:'payment'});
 assert.ok(updated.startsWith(note+'\n\n'));
 assert.deepEqual(readInvestigation(updated),{channel:'social',device:'desktop',stage:'checkout',hypothesis:'payment',rationale:'',condition:''});
});

test('partial updates preserve whitespace, special characters and surrounding user notes',()=>{
 const rationale='  담당자 입력: $& $1 $` [배송] \\ "확인"  ';
 const condition='\t화면 대조 후 다시 검토  ';
 const original=updateInvestigation('',{rationale,condition,channel:'search'});
 const note='기존 메모\r\n'+original.replaceAll('\n','\r\n')+'\r\n후속 메모 $&  ';
 const updated=updateInvestigation(note,{rationale});
 assert.ok(updated.startsWith('기존 메모\r\n'));
 assert.ok(updated.endsWith('\r\n후속 메모 $&  '));
 assert.deepEqual(readInvestigation(updated),{channel:'search',device:'all',stage:'all',hypothesis:'none',rationale,condition});
 assert.equal(updateInvestigation(updated,{}),updated);
 assert.equal(readInvestigation(updateInvestigation(updated,{rationale:''})).rationale,'');
});

test('all supported scope labels round trip through readable text',()=>{
 for (const channel of ['all','search','social'] as const) for (const device of ['all','mobile','desktop'] as const) for (const stage of ['all','cost','checkout','revenue','refund'] as const) for (const hypothesis of ['none','guidance','payment','audience','tracking'] as const) {
  const note=updateInvestigation('',{channel,device,stage,hypothesis});
  assert.deepEqual(readInvestigation(note),{channel,device,stage,hypothesis,rationale:'',condition:''});
  assert.ok(!note.includes('{'));
 }
});

test('oversize and multiline input fail without truncating or replacing the old note',()=>{
 const note=updateInvestigation('기존 메모',{rationale:'담당자 입력'});
 for (const rationale of ['x'.repeat(1001),'첫 줄\n다음 줄','첫 줄\r다음 줄','첫 줄\u2028다음 줄']) assert.throws(()=>updateInvestigation(note,{rationale}),/1000자|한 줄/);
 assert.equal(readInvestigation(updateInvestigation('',{rationale:'x'.repeat(1000)})).rationale.length,1000);
 const overhead=updateInvestigation('',{}).length;
 const exactly=updateInvestigation('x'.repeat(5000-overhead-2),{});
 assert.equal(exactly.length,5000);
 assert.throws(()=>updateInvestigation('x'.repeat(5001-overhead-2),{}),/5000자/);
 assert.equal(readInvestigation(note).rationale,'담당자 입력');
});

test('ambiguous or malformed sections remain unchanged and updates explain the conflict',()=>{
 const note=updateInvestigation('',{channel:'social'});
 for (const broken of [note+'\n'+note,note.replace('매체: 소셜','매체: 알 수 없음'),note.replace('문제 단계: 전체 단계','문제 단계 변경: 전체 단계')]) {
  assert.equal(readInvestigation(broken).channel,'all');
  assert.throws(()=>updateInvestigation(broken,{channel:'search'}),/조사 요약/);
 }
 assert.throws(()=>updateInvestigation(note,{device:'unknown' as 'all'}),/선택값/);
});


test('selected action reconnect fills empty fields, preserves authored text and blocks stale scope',()=>{
 const note=updateInvestigation('',{channel:'social',device:'desktop',stage:'checkout',hypothesis:'guidance',rationale:'확인한 의견을 실제 안내와 대조',condition:'안내 불일치 확인 후 수정'});
 const value=readInvestigation(note);
 const empty=connectInvestigationAction('기존 수정 문구',readInvestigation(''));
 const text=connectInvestigationAction(empty,value);
 assert.ok(text.includes('선택 이유: '+value.rationale));
 assert.ok(text.includes('적용 조건: '+value.condition));
 assert.equal(validateInvestigationReview({note,actions:[{selected:true,text}]}).length,0);
 const authored=text.replace('선택 이유: '+value.rationale,'선택 이유: 담당자 자유 판단');
 assert.ok(connectInvestigationAction(authored,{...value,rationale:'변경'}).includes('선택 이유: 담당자 자유 판단'));
 const moved=updateInvestigation(note,{device:'mobile'},{resetJudgment:true});
 assert.ok(validateInvestigationReview({note:moved,actions:[{selected:true,text}]}).some(error=>error.includes('조사 범위')));
});

test('alternative investigations export as further checks without inappropriate shipping actions',()=>{
 const note=updateInvestigation('기존 메모',{channel:'social',device:'desktop',stage:'checkout',hypothesis:'payment',rationale:'결제 이후 감소 확인',condition:'실패 로그와 재현 결과 대조'});
 assert.deepEqual(validateInvestigationReview({note,actions:[]}),[]);
 assert.ok(validateInvestigationReview({note,actions:[{selected:true,text:'안내 변경'}]}).length);
 const broken=note.replace('매체: 소셜','매체: 알 수 없음');
 assert.throws(()=>readInvestigationStrict(broken),/조사 요약/);
 assert.ok(validateInvestigationReview({note:broken,actions:[]}).length);
});


test('scope change cannot relabel an old judgment without explicit replacement',()=>{
 const prior=readInvestigation(updateInvestigation('',{channel:'social',device:'desktop',stage:'checkout',hypothesis:'guidance',rationale:'소셜 PC 확인',condition:'소셜 PC 대조 후 수정'}));
 const next={...prior,channel:'search' as const,device:'mobile' as const,rationale:'검색 모바일 확인',condition:'검색 모바일 대조 후 수정'};
 const old=connectInvestigationAction('수정안',prior);
 assert.equal(connectInvestigationAction(old,next),old);
 const note=updateInvestigation('',next);
 assert.ok(validateInvestigationReview({note,actions:[{selected:true,text:old}]}).length);
 const replaced=connectInvestigationAction(old,next,true);
 assert.ok(replaced.includes('선택 이유: '+next.rationale));assert.ok(!replaced.includes(prior.rationale));
 assert.deepEqual(validateInvestigationReview({note,actions:[{selected:true,text:replaced}]}),[]);
 assert.ok(validateInvestigationReview({note:updateInvestigation(note,{stage:'cost'},{resetJudgment:true}),actions:[{selected:true,text:replaced}]}).length);
});

test('free-note edits preserve user bytes and the exact managed section without delimiter accumulation',()=>{
 const managed=updateInvestigation('',{stage:'checkout',hypothesis:'payment',rationale:'$& 원문',condition:'대조'}).replaceAll('\n','\r\n');
 const note='앞 메모 $&\r\n'+managed+'\r\n뒤 메모  ';
 const free=freeInvestigationNote(note);
 assert.equal(free,'앞 메모 $&\r\n\r\n뒤 메모  ');
 const edited=replaceFreeInvestigationNote(note,free+'\n새 메모');
 assert.ok(edited.includes(managed));
 assert.ok(freeInvestigationNote(edited).startsWith(free+'\n새 메모'));
 assert.equal(replaceFreeInvestigationNote(edited,freeInvestigationNote(edited)),edited);
 assert.throws(()=>replaceFreeInvestigationNote(note,'[조사 범위와 판단]'),/구분자/);
 assert.throws(()=>replaceFreeInvestigationNote(note,'x'.repeat(5000)),/5000자/);
});

test('explicit malformed-section recovery preserves every original character with escaped delimiter lines',()=>{
 const original=updateInvestigation('자유 메모\r\n  $&',{channel:'social',rationale:'담당자 문구'}).replace('기기: 전체 기기','기기: PC');
 assert.throws(()=>freeInvestigationNote(original),/조사 요약/);
 const recovered=recoverInvestigation(original);
 assert.ok(freeInvestigationNote(recovered).startsWith(original.replace(/^(\[\/?조사 범위와 판단\])(?=\r?$)/gm,'\\$1')));
 assert.equal(readInvestigationStrict(recovered).rationale,'');
 assert.equal(readInvestigationStrict(updateInvestigation(recovered,{channel:'search'})).channel,'search');
 assert.equal(recoverInvestigation(recovered),recovered);
 assert.throws(()=>recoverInvestigation(original+'x'.repeat(5000)),/5000자/);
});

test('changing scope or hypothesis requires explicit judgment preservation and prevents stale output',()=>{
 const note=updateInvestigation('기존 자유 메모  ',{channel:'social',device:'mobile',stage:'checkout',hypothesis:'payment',rationale:'소셜 모바일 구매 24에서 10',condition:'소셜 모바일 로그 대조'});
 for(const patch of [{channel:'search' as const},{device:'desktop' as const},{stage:'cost' as const},{hypothesis:'tracking' as const}])assert.throws(()=>updateInvestigation(note,patch),/이전 판단/);
 const moved=updateInvestigation(note,{channel:'search',device:'desktop',stage:'cost',rationale:'우회 시도'},{resetJudgment:true});
 assert.deepEqual(readInvestigationStrict(moved),{channel:'search',device:'desktop',stage:'cost',hypothesis:'none',rationale:'',condition:''});
 assert.ok(freeInvestigationNote(moved).startsWith('기존 자유 메모  '));
 assert.ok(freeInvestigationNote(moved).includes('소셜 모바일 구매 24에서 10'));
 assert.ok(freeInvestigationNote(moved).includes('이전 적용 조건: 소셜 모바일 로그 대조'));
 assert.ok(!/^재검토 조건:/m.test(freeInvestigationNote(moved)));
 assert.ok(!/^근거:/m.test(freeInvestigationNote(moved)));
 assert.ok(validateInvestigationReview({note:moved,actions:[]}).length);
 const again=updateInvestigation(moved,{device:'mobile'},{resetJudgment:true});
 assert.equal((again.match(/\[이전 조사 판단\]/g)||[]).length,1);
 const hypothesis=readInvestigationStrict(updateInvestigation(note,{hypothesis:'tracking'},{resetJudgment:true}));
 assert.equal(hypothesis.hypothesis,'tracking');assert.equal(hypothesis.rationale,'');
});

test('unknown-cause further-check plans may export without invented hypotheses',()=>{
 const note=updateInvestigation('',{stage:'checkout',rationale:'감소 구간을 관측함',condition:'원인 미확인, 결제 로그와 안내를 대조'});
 assert.deepEqual(validateInvestigationReview({note,actions:[]}),[]);
 assert.ok(validateInvestigationReview({note,actions:[{selected:true,text:'안내 변경'}]}).length);
});
