import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadCatalog} from '../../docs/research/marketing-ontology/batches/D007/catalog.mjs';
import {CatalogTools} from '../../backend/agent-tools.mjs';
import {AgentFlow, FlowStore} from '../../backend/agent-flow.mjs';
export {localPlanner as planner} from '../../backend/local-planner.mjs';

export const catalog = loadCatalog();
export const scope = {batch:'D007', country:'KR', scopeId:'D007-KR-sample', productIds:['P1A','P2A'],
  start:'2026-08-01', end:'2026-09-01', asOf:'2026-10-18T00:00:00Z'};
export const clock = () => '2026-10-18T00:00:00Z';
export const tools = new CatalogTools(catalog);
export function makeFlow(model, db=':memory:', overrides={}) {
  const store = new FlowStore(db);
  return new AgentFlow({tools, model, store, now:clock, ...overrides});
}
// Only requests and model/control responses are synthesized. Marketing values
// and source records always come from the approved, unmodified catalog.
export async function analyzed(flow) {
  return flow.analyze({question:'선택 시장의 경쟁 열위와 가격 관련 근거를 확인해줘',scope});
}
export async function proposed(flow) {
  const analysis = await analyzed(flow);
  return flow.budget({analysisId:analysis.id, analysisVersion:analysis.version,userSelected:true});
}
export const principal = {id:'local-test-operator',role:'synthetic_analyst'};
export async function approved(flow) {
  const proposal = await proposed(flow);
  return flow.approve(proposal.id,{version:proposal.version,principal,expiresAt:'2026-10-19T00:00:00Z'});
}
export function adapter(proposal, changes={}) {
  let calls=0;
  return {mode:'synthetic',get calls(){return calls;},
    async preflight(){return {allocations:proposal.simulation.baseline.allocations};},
    async submit(){calls++;return {operationId:'test-operation',status:'pending'};},
    async status(){return {status:'applied',allocations:proposal.simulation.candidate.allocations};},...changes};
}
export function sourceHashes() {
  return catalog.filter(x=>x.batch==='D007').map(x=>JSON.stringify(x.source));
}
export const root = fileURLToPath(new URL('../../',import.meta.url));
export const rawRows = type=>fs.readFileSync(new URL(`../../docs/research/marketing-ontology/batches/D007/source/${type}.jsonl`,import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
