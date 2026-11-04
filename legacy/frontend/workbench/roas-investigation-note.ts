export type Investigation = {
 channel:'all'|'search'|'social';
 device:'all'|'mobile'|'desktop';
 stage:'all'|'cost'|'checkout'|'revenue'|'refund';
 hypothesis:'none'|'guidance'|'payment'|'audience'|'tracking';
 rationale:string;
 condition:string;
};

export function investigationScope(value:Investigation){
 return [labels.channel[value.channel],value.device==='desktop'?'PC':value.device==='all'?'양 기기':'모바일',({all:'문제 단계 미선택',cost:'클릭 비용',checkout:'결제 시작 이후 구매',revenue:'구매당 금액',refund:'취소와 환불'})[value.stage]].join(' / ');
}

export function validateInvestigationReview(content:{note:string;actions:{selected:boolean;text:string}[]}){
 let value:Investigation;try{value=readInvestigationStrict(content.note);}catch(error){return [error instanceof Error?error.message:'조사 메모를 확인해 주세요.'];}
 const errors:string[]=[];
 if(value.stage==='all')errors.push('조사할 문제를 선택해 주세요.');
 if(!value.rationale.trim()||!value.condition.trim())errors.push('선택한 문제의 판단 근거와 다음 확인, 적용 조건을 작성해 주세요.');
 const chosen=content.actions.filter(action=>action.selected);
 if(chosen.length&&!['checkout','revenue'].includes(value.stage))errors.push('안내 수정안은 결제 이후 구매 또는 구매금액 문제에서 검토하세요. 비용과 환불 문제는 추가 확인 계획을 남기세요.');
 if(chosen.length&&value.hypothesis!=='guidance')errors.push('안내 수정후보는 안내 문제를 조사할 때 선택하세요. 다른 후보는 안내 수정안을 해제하고 다음 확인을 남기세요.');
 if(chosen.some(action=>!action.text.split(/\r?\n/).some(line=>line.trim()==='대상 문제: '+investigationScope(value))))errors.push('조사 범위가 수정안과 다릅니다. 기존 판단을 확인한 뒤 현재 조사로 대상, 이유, 조건 교체를 선택해 주세요.');
 return errors;
}

const labels = {
 channel:{all:'전체 매체',search:'검색',social:'소셜'},
 device:{all:'전체 기기',mobile:'모바일',desktop:'데스크톱'},
 stage:{all:'전체 단계',cost:'광고 비용',checkout:'결제 완료',revenue:'구매 금액',refund:'취소와 환불'},
 hypothesis:{none:'선택하지 않음',guidance:'배송과 금액 안내',payment:'결제 기능',audience:'유입 고객 구성',tracking:'측정과 집계'},
} as const;
const defaults:Investigation = {channel:'all',device:'all',stage:'all',hypothesis:'none',rationale:'',condition:''};
const start = '[조사 범위와 판단]';
const end = '[/조사 범위와 판단]';
const section = /^\[조사 범위와 판단\]\r?\n매체: ([^\r\n]*)\r?\n기기: ([^\r\n]*)\r?\n문제 단계: ([^\r\n]*)\r?\n설명 후보: ([^\r\n]*)\r?\n수정안 선택 근거: ([^\r\n]*)\r?\n재검토 조건: ([^\r\n]*)\r?\n\[\/조사 범위와 판단\](?=\r?$)/gm;

function inspect(note:string) {
 const matches = [...note.matchAll(section)];
 const markers = note.split(/\r?\n/).filter(line=>line===start||line===end);
 if (!matches.length && !markers.length) return null;
 if (matches.length!==1 || markers.length!==2) throw Error('조사 요약이 중복되거나 서식이 변경되었습니다. 조사 요약 구간을 확인해 주세요.');
 const match = matches[0];
 const result = {...defaults};
 for (const [index,key] of (['channel','device','stage','hypothesis'] as const).entries()) {
  const value = Object.entries(labels[key]).find(([,label])=>label===match[index+1])?.[0];
  if (!value) throw Error('조사 요약의 선택값을 확인해 주세요.');
  Object.assign(result,{[key]:value});
 }
 result.rationale=match[5];result.condition=match[6];
 return {match,result};
}

export function readInvestigationStrict(note:string):Investigation {
 return inspect(note)?.result ?? {...defaults};
}

/** Only the free text is editable; callers keep the managed section out of its textarea. */
export function freeInvestigationNote(note:string):string {
 const existing=inspect(note);
 return existing?note.slice(0,existing.match.index)+note.slice(existing.match.index!+existing.match[0].length):note;
}

export function replaceFreeInvestigationNote(note:string,text:string):string {
 const existing=inspect(note);
 // User text must never become another active investigation section.
 if(text.split(/\r?\n/).some(line=>line===start||line===end))throw Error('자유 메모에는 조사 요약 구분자를 입력할 수 없습니다.');
 const result=text+(existing?(text&&!text.endsWith('\n')?'\n\n':'')+existing.match[0]:'');
 if(result.length>5000)throw Error('조사 요약을 포함한 메모는 5000자 이내여야 합니다. 기존 메모를 확인해 주세요.');
 return result;
}

/** Explicit recovery only: preserve the original wording and neutralize its active delimiters. */
export function recoverInvestigation(note:string):string {
 try{inspect(note);return note;}catch{
  const preserved=note.replace(/^(\[\/?조사 범위와 판단\])(?=\r?$)/gm,'\\$1');
  return updateInvestigation(preserved,{});
 }
}

export function connectInvestigationAction(text:string,value:Investigation,replaceJudgment=false):string {
 const prior=text.match(/^대상 문제:([^\r\n]*)$/m)?.[1].trim();
 if(!replaceJudgment&&prior&&prior!==investigationScope(value)&&/^(?:선택 이유|적용 조건):[^\S\r\n]*\S/m.test(text))return text;
 const fields={'대상 문제':investigationScope(value),'선택 이유':value.rationale,'적용 조건':value.condition};
 for(const [label,content] of Object.entries(fields)) {
  const pattern=new RegExp('^'+label+':([^\\r\\n]*)$','m');
  const match=text.match(pattern);
  if(match){if(replaceJudgment||label==='대상 문제'||!match[1].trim())text=text.replace(pattern,()=>label+': '+content);}
  else text+='\n'+label+': '+content;
 }
 return text;
}

// Older free-form notes have no investigation section and retain the default scope.
export function readInvestigation(note:string):Investigation {
 try {return inspect(note)?.result ?? {...defaults};} catch {return {...defaults};}
}

export function updateInvestigation(note:string,partial:Partial<Investigation>,options:{resetJudgment?:boolean}={}):string {
 const existing=inspect(note);
 const value={...(existing?.result ?? defaults),...partial};
 for (const key of ['channel','device','stage','hypothesis'] as const) {
  if (!Object.hasOwn(labels[key],value[key])) throw Error('조사 범위와 설명 후보의 선택값을 확인해 주세요.');
 }
 const changed=existing&&(['channel','device','stage','hypothesis'] as const).some(key=>value[key]!==existing.result[key]);
 if(changed&&(existing.result.rationale.trim()||existing.result.condition.trim())){
  if(!options.resetJudgment)throw Error('조사 범위나 설명 후보가 바뀝니다. 이전 판단을 메모에 보존하고 새 판단을 시작할지 확인해 주세요.');
  const prior=existing.result;
  const archive=['[이전 조사 판단]',`이전 대상 문제: ${investigationScope(prior)}`,`이전 설명 후보: ${labels.hypothesis[prior.hypothesis]}`,`이전 판단 근거: ${prior.rationale}`,`이전 적용 조건: ${prior.condition}`,'[/이전 조사 판단]'].join('\n');
  const free=freeInvestigationNote(note);
  note=replaceFreeInvestigationNote(note,free+(free&&!free.endsWith('\n')?'\n\n':'')+archive);
  value.rationale='';value.condition='';
 }
 if(existing&&(['channel','device','stage'] as const).some(key=>value[key]!==existing.result[key]))value.hypothesis='none';
 const destination=inspect(note);
 for (const key of ['rationale','condition'] as const) {
  if (typeof value[key]!=='string' || /[\r\n\u2028\u2029]/.test(value[key])) throw Error('수정안 선택 근거와 재검토 조건은 한 줄로 입력해 주세요.');
  if (value[key].length>1000) throw Error('수정안 선택 근거와 재검토 조건은 각각 1000자 이내로 입력해 주세요.');
 }
 const text=[start,`매체: ${labels.channel[value.channel]}`,`기기: ${labels.device[value.device]}`,`문제 단계: ${labels.stage[value.stage]}`,`설명 후보: ${labels.hypothesis[value.hypothesis]}`,`수정안 선택 근거: ${value.rationale}`,`재검토 조건: ${value.condition}`,end].join('\n');
 // Slice around the managed section so unrelated notes and literal replacement characters survive.
 const result=destination ? note.slice(0,destination.match.index)+text+note.slice(destination.match.index!+destination.match[0].length) : note+(note?'\n\n':'')+text;
 if (result.length>5000) throw Error('조사 요약을 포함한 메모는 5000자 이내여야 합니다. 기존 메모를 확인해 주세요.');
 return result;
}
