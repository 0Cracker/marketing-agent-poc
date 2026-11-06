import {createHash, randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const DAY = 86400000;
const terminal = new Set(['completed','partial','withheld','blocked','cancelled','interrupted']);
const sensitive = /api[_-]?key|bearer\s|password|secret|token|raw.?prompt|hidden.?reasoning|AIza[\w-]{15,}|sk-[\w-]{12,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|01[016789][- ]?\d{3,4}[- ]?\d{4}/i;
export class RunApiError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export const fingerprint = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const safe = (v, n=180) => typeof v==='string' && v.length<=n && !sensitive.test(v) ? v : undefined;
const ids = a => Array.isArray(a) ? a.filter(v=>safe(v,128)!==undefined).slice(0,100) : [];
function eventValue(e={}) {
  const out={evidenceIds:ids(e.evidenceIds)};
  for(const k of ['stage','tool','model','provider','transport','billingBucket','status','errorCode','kind']) {
    const v=safe(e[k],100);if(v!==undefined)out[k]=v;
  }
  if(safe(e.argsSummary)!==undefined)out.argsSummary=e.argsSummary;
  for(const k of ['count','rowCount','elapsed','elapsedMs']) if(Number.isFinite(e[k])&&e[k]>=0)out[k]=e[k];
  return out;
}
function resultValue(result,status) {
  if(!result||typeof result!=='object')return null;
  const verified=result.verified===true||result.verification?.passed===true;
  const out={evidenceIds:ids(result.evidenceIds),limitations:ids(result.limitations).slice(0,30),verification:{passed:verified}};
if(verified&&['completed','partial'].includes(status)) {
    const answer=safe(result.answer,20000);if(answer!==undefined)out.answer=answer;
    const sections=result.sections;
    if(sections&&typeof sections==='object'&&!Array.isArray(sections)) {
      const conclusion=safe(sections.conclusion,1000);
      const lists=['summary','reasoning','actions','limitations'];
      if(conclusion!==undefined&&lists.every(k=>Array.isArray(sections[k])&&sections[k].length<=4&&
          sections[k].every(v=>safe(v,1000)!==undefined))) {
        out.sections={conclusion,...Object.fromEntries(lists.map(k=>[k,sections[k]]))};
      }
    }
  }
  return out;
}
function usageValue(usage={}) {
  const out={};
  for(const k of ['modelAttempts','inputTokens','outputTokens','reportedCostUsd','toolCalls'])
    if(Number.isFinite(usage[k])&&usage[k]>=0)out[k]=usage[k];
  return out;
}
function hashesValue(hashes={}) {
  if(!hashes||typeof hashes!=='object'||Array.isArray(hashes))return {};
  return Object.fromEntries(Object.entries(hashes)
    .filter(([k,v])=>/^[a-zA-Z][\w-]{0,50}$/.test(k)&&typeof v==='string'&&/^[a-zA-Z0-9:_-]{8,160}$/.test(v)).slice(0,20));
}
export function createRunStore({dbPath,now=Date.now,maxConcurrentRuns=2,maxStartsPerMinute=8,maxModelAttemptsPerDay=60,cleanupIntervalMs=3600000}={}) {
  if(!dbPath)throw new RunApiError('db_path_required');
  const db=new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  db.exec([
    'CREATE TABLE IF NOT EXISTS roas_runs (',
    'run_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, browser_id TEXT NOT NULL,',
    'thread_id TEXT NOT NULL, request_id TEXT NOT NULL, input_hash TEXT NOT NULL,',
    'scope_json TEXT NOT NULL, scope_fingerprint TEXT NOT NULL, source_hashes_json TEXT NOT NULL DEFAULT "{}",',
    'route TEXT, stage TEXT NOT NULL DEFAULT "scope_locked", execution_status TEXT NOT NULL DEFAULT "queued",',
    'cause_status TEXT, stop_reason TEXT, result_json TEXT, usage_json TEXT, started_at INTEGER NOT NULL,',
    'terminal_at INTEGER, expires_at INTEGER, version INTEGER NOT NULL DEFAULT 0,',
    'UNIQUE(account_id,browser_id,request_id));',
    'CREATE UNIQUE INDEX IF NOT EXISTS one_active_thread ON roas_runs(account_id,browser_id,thread_id) WHERE terminal_at IS NULL;',
    'CREATE INDEX IF NOT EXISTS run_expiry ON roas_runs(expires_at);',
    'CREATE TABLE IF NOT EXISTS roas_events (run_id TEXT NOT NULL REFERENCES roas_runs(run_id) ON DELETE CASCADE,',
    'seq INTEGER NOT NULL, at INTEGER NOT NULL, event_json TEXT NOT NULL, PRIMARY KEY(run_id,seq));',
    'CREATE TABLE IF NOT EXISTS roas_evidence (run_id TEXT NOT NULL REFERENCES roas_runs(run_id) ON DELETE CASCADE,',
    'evidence_id TEXT NOT NULL, source_hash TEXT, source_version TEXT, period_id TEXT, tool TEXT,',
    'source_row_ids_json TEXT NOT NULL DEFAULT "[]", PRIMARY KEY(run_id,evidence_id));',
    'CREATE TABLE IF NOT EXISTS roas_request_limits (account_id TEXT NOT NULL, at INTEGER NOT NULL);',
    'CREATE TABLE IF NOT EXISTS roas_model_limits (account_id TEXT NOT NULL, run_id TEXT NOT NULL,',
    'at INTEGER NOT NULL, attempts INTEGER NOT NULL);',
    'CREATE INDEX IF NOT EXISTS request_limit_window ON roas_request_limits(account_id,at);',
    'CREATE INDEX IF NOT EXISTS model_limit_window ON roas_model_limits(account_id,at);'
  ].join(' '));
  const time=()=>{const v=now();return v instanceof Date?v.getTime():v;};
  function tx(fn) {
    db.exec('BEGIN IMMEDIATE');
    try{const v=fn();db.exec('COMMIT');return v;}
    catch(e){db.exec('ROLLBACK');throw e;}
  }
  function prune(t) {
    db.prepare('DELETE FROM roas_runs WHERE expires_at IS NOT NULL AND expires_at <= ?').run(t);
    db.prepare('DELETE FROM roas_request_limits WHERE at <= ?').run(t-60000);
    db.prepare('DELETE FROM roas_model_limits WHERE at <= ?').run(t-DAY);
  }
  const lookup=(id,account,browser)=>db.prepare('SELECT * FROM roas_runs WHERE run_id=? AND account_id=? AND browser_id=?').get(id,account,browser);
  function append(id,e,t) {
    const seq=db.prepare('SELECT COALESCE(MAX(seq),0)+1 n FROM roas_events WHERE run_id=?').get(id).n;
    db.prepare('INSERT INTO roas_events(run_id,seq,at,event_json) VALUES(?,?,?,?)').run(id,seq,t,JSON.stringify(eventValue(e)));
  }
  function view(row,after=0) {
    const events=db.prepare('SELECT seq,at,event_json FROM roas_events WHERE run_id=? AND seq>? ORDER BY seq')
      .all(row.run_id,after).map(e=>({seq:e.seq,at:e.at,...JSON.parse(e.event_json)}));
    const lastEventSeq=db.prepare('SELECT COALESCE(MAX(seq),0) n FROM roas_events WHERE run_id=?').get(row.run_id).n;
    const s=row.execution_status;
    return {
      runId:row.run_id,runStatus:s==='queued'?'accepted':['partial','withheld','blocked'].includes(s)?'completed':s,
      executionStatus:s,stage:row.stage,route:row.route,scopeFingerprint:row.scope_fingerprint,
      appliedScope:JSON.parse(row.scope_json),sourceHashes:JSON.parse(row.source_hashes_json),
      ...(row.cause_status?{causeStatus:row.cause_status}:{}),...(row.stop_reason?{stopReason:row.stop_reason}:{}),
      startedAt:row.started_at,...(row.terminal_at===null?{}:{terminalAt:row.terminal_at}),
      ...(row.terminal_at!==null&&row.result_json?{result:JSON.parse(row.result_json)}:{}),
      usage:row.usage_json?JSON.parse(row.usage_json):{},events,lastEventSeq,version:row.version
    };
  }
  tx(()=>{const t=time();prune(t);db.prepare("UPDATE roas_runs SET execution_status='interrupted',stage='terminal',stop_reason='server_interrupted',terminal_at=?,expires_at=?,version=version+1 WHERE terminal_at IS NULL").run(t,t+30*DAY);});
  const cleanupTimer=cleanupIntervalMs>0?setInterval(()=>{try{tx(()=>prune(time()));}catch{/* A failed cleanup cannot terminate active runs. */}},cleanupIntervalMs):null;
  cleanupTimer?.unref();
  return {
    claimRun({runId=randomUUID(),accountId,browserId,threadId,clientRequestId,inputHash,scope,scopeFingerprint}) {
      return tx(()=>{
        const t=time();prune(t);
        const existing=db.prepare('SELECT run_id,input_hash,execution_status FROM roas_runs WHERE account_id=? AND browser_id=? AND request_id=?').get(accountId,browserId,clientRequestId);
        if(existing){
          if(existing.input_hash!==inputHash)throw new RunApiError('idempotency_conflict');
          return {runId:existing.run_id,executionStatus:existing.execution_status,duplicate:true};
        }
        if(db.prepare('SELECT 1 FROM roas_runs WHERE account_id=? AND browser_id=? AND thread_id=? AND terminal_at IS NULL').get(accountId,browserId,threadId))throw new RunApiError('run_in_progress');
        if(db.prepare('SELECT COUNT(*) n FROM roas_runs WHERE account_id=? AND terminal_at IS NULL').get(accountId).n>=maxConcurrentRuns)throw new RunApiError('concurrency_limited');
        if(db.prepare('SELECT COUNT(*) n FROM roas_request_limits WHERE account_id=? AND at>?').get(accountId,t-60000).n>=maxStartsPerMinute)throw new RunApiError('rate_limited');
        db.prepare('INSERT INTO roas_runs(run_id,account_id,browser_id,thread_id,request_id,input_hash,scope_json,scope_fingerprint,started_at) VALUES(?,?,?,?,?,?,?,?,?)')
          .run(runId,accountId,browserId,threadId,clientRequestId,inputHash,JSON.stringify(scope),scopeFingerprint,t);
        db.prepare('INSERT INTO roas_request_limits(account_id,at) VALUES(?,?)').run(accountId,t);
        append(runId,{stage:'scope_locked',kind:'accepted',status:'queued'},t);
        return {runId,executionStatus:'queued',duplicate:false};
      });
    },
    getRun({runId,accountId,browserId,afterEventSeq=0}) {
      tx(()=>prune(time()));const row=lookup(runId,accountId,browserId);return row?view(row,afterEventSeq):null;
    },
    listTraceRuns() {
      return db.prepare(`SELECT run_id AS runId, execution_status AS executionStatus, stage,
        started_at AS startedAt, terminal_at AS terminalAt, stop_reason AS stopReason,
        EXISTS(SELECT 1 FROM roas_events e WHERE e.run_id=r.run_id AND
          (json_extract(e.event_json,'$.status') IN ('failed','error','withheld','partial')
          OR json_extract(e.event_json,'$.kind') IN ('model_error','tool_rejected','failure'))) AS hadFailure
        FROM roas_runs r WHERE expires_at IS NULL OR expires_at>? ORDER BY started_at DESC LIMIT 50`).all(time());
    },
    getTraceRun(runId,after=0,original=false) {
      const row=db.prepare('SELECT * FROM roas_runs WHERE run_id=? AND (expires_at IS NULL OR expires_at>?)').get(runId,time());
      if(!row)return null;
      if(original)return db.prepare('SELECT event_json FROM roas_events WHERE run_id=? ORDER BY seq')
        .all(runId).map(event=>event.event_json);
      const {executionStatus,stage,startedAt,terminalAt,stopReason,events,lastEventSeq,route,appliedScope,result}=view(row,after);
      const {caseId,snapshot,metric,filters}=appliedScope;
      const scope={caseId:safe(caseId,64),snapshot:safe(snapshot,32),metric:safe(metric,50),
        filters:Object.fromEntries(['channel','source','campaignId','device'].map(key=>[key,safe(filters?.[key],100)]))};
      const publishedAnswer=result?.sections?.conclusion||result?.answer;
      return {runId,executionStatus,stage,startedAt,terminalAt,stopReason,events,lastEventSeq,route,scope,publishedAnswer};
    },
    // C must reserve an attempt BEFORE every provider call. Shared account hard cap.
    claimModelAttempt({runId,accountId}) {
      return tx(()=>{
        const t=time();prune(t);
        const row=db.prepare('SELECT account_id,terminal_at FROM roas_runs WHERE run_id=?').get(runId);
        if(!row||row.account_id!==accountId||row.terminal_at!==null)throw new RunApiError('run_not_active');
        const n=db.prepare('SELECT COALESCE(SUM(attempts),0) n FROM roas_model_limits WHERE account_id=? AND at>?').get(accountId,t-DAY).n;
        if(n>=maxModelAttemptsPerDay)throw new RunApiError('model_budget_exhausted');
        db.prepare('INSERT INTO roas_model_limits(account_id,run_id,at,attempts) VALUES(?,?,?,1)').run(accountId,runId,t);
        return {remaining:maxModelAttemptsPerDay-n-1};
      });
    },
    saveRun({runId,executionStatus,stage,route,sourceHashes,causeStatus,stopReason,result,usage,event}) {
      return tx(()=>{
        const row=db.prepare('SELECT * FROM roas_runs WHERE run_id=?').get(runId);
        if(!row)throw new RunApiError('run_not_found');
        if(row.terminal_at!==null)return false;
        if(executionStatus&&!['queued','running',...terminal].includes(executionStatus))throw new RunApiError('invalid_status');
        const requested=executionStatus||row.execution_status,done=terminal.has(requested),t=time();
        if(row.execution_status==='running'&&requested==='queued')throw new RunApiError('invalid_status_transition');
        const finalAnswer=['completed','partial'].includes(requested);
        const unverified=finalAnswer&&!(result?.verified===true||result?.verification?.passed===true);
        const unissued=done&&ids(result?.evidenceIds).some(id=>!db.prepare('SELECT 1 FROM roas_evidence WHERE run_id=? AND evidence_id=?').get(runId,id));
        const status=unverified||unissued?'withheld':requested;
        if(unverified||unissued)stopReason='validation_failed';
        db.prepare('UPDATE roas_runs SET execution_status=?,stage=?,route=?,source_hashes_json=?,cause_status=?,stop_reason=?,result_json=?,usage_json=?,terminal_at=?,expires_at=?,version=version+1 WHERE run_id=? AND terminal_at IS NULL')
          .run(status,safe(stage,90)||(done?'terminal':row.stage),safe(route,90)||row.route,
            sourceHashes===undefined?row.source_hashes_json:JSON.stringify(hashesValue(sourceHashes)),
            ['not_assessed','confirmed','undetermined'].includes(causeStatus)?causeStatus:row.cause_status,
            safe(stopReason,90)||row.stop_reason,done?JSON.stringify(resultValue(result,status)):null,
            usage===undefined?row.usage_json:JSON.stringify(usageValue(usage)),
            done?t:null,done?t+30*DAY:null,runId);
        if(event)append(runId,event,t);return true;
      });
    },
    recordEvent({runId,event}) {
      return tx(()=>{const row=db.prepare('SELECT terminal_at FROM roas_runs WHERE run_id=?').get(runId);
        if(!row||row.terminal_at!==null)return false;append(runId,event,time());return true;});
    },
    publishEvidence({runId,evidence}) {
      return tx(()=>{const row=db.prepare('SELECT terminal_at FROM roas_runs WHERE run_id=?').get(runId);
        if(!row||row.terminal_at!==null)return false;
        const id=safe(evidence?.evidenceId,128);if(!id)throw new RunApiError('invalid_evidence');
        db.prepare('INSERT OR IGNORE INTO roas_evidence(run_id,evidence_id,source_hash,source_version,period_id,tool,source_row_ids_json) VALUES(?,?,?,?,?,?,?)')
          .run(runId,id,safe(evidence.sourceHash,160)||null,safe(evidence.sourceVersion,90)||null,
            safe(evidence.periodId,90)||null,safe(evidence.tool,90)||null,JSON.stringify(ids(evidence.sourceRowIds)));
        return true;});
    },
    cancelRun({runId,accountId,browserId}) {
      return tx(()=>{
        const row=lookup(runId,accountId,browserId);if(!row)return null;
        if(row.terminal_at!==null)return {executionStatus:row.execution_status,cancelledNow:false};
        const t=time();
        db.prepare("UPDATE roas_runs SET execution_status='cancelled',stage='terminal',stop_reason='user_cancelled',terminal_at=?,expires_at=?,version=version+1 WHERE run_id=? AND terminal_at IS NULL").run(t,t+30*DAY,runId);
        append(runId,{stage:'terminal',kind:'cancelled',status:'cancelled'},t);
        return {executionStatus:'cancelled',cancelledNow:true};
      });
    },
    cleanup(){tx(()=>prune(time()));},
    close(){if(cleanupTimer)clearInterval(cleanupTimer);db.close();}
  };
}
