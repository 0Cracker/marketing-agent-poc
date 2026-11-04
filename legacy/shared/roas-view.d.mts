type EvidenceChannel = {
  channel: string;
  campaignId: string;
  evidence: {adRecordIds: string[]; orderRecordIds: string[]; adjustmentRecordIds: string[]};
};
type EvidenceReport = {
  asOf: string;
  periods: {period: {start: string; end: string}; channels: EvidenceChannel[]}[];
};
export function selectRoasEvidence<T extends Record<string, unknown>>(
  records: T[], report: EvidenceReport,
  selection?: {channel?: string; types?: string[]; ids?: string[]}
): T[];

export function roasEvidenceTime(row:Record<string,unknown>):string;
export function filterRoasEvidence<T extends Record<string,unknown>>(
 records:T[], periods:{period:{start:string;end:string}}[],
 options?:{query?:string;period?:string;type?:string;sort?:string}
):T[];
