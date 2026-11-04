type Period = {start: string; end: string};
type ContributionChannel = {
  channel: string; campaignId: string;
  reported: {spend: string}; purchaseCohort: {netRoas: number | null};
};
type ContributionPeriod = {channels: ContributionChannel[]; total: {spend: string; netRoas: number | null}};
export type DiagnosisReport = {
  asOf: string;
  periods: {period: Period; channels: {channel: string; campaignId: string; evidence: {adRecordIds: string[]; orderRecordIds: string[]; adjustmentRecordIds?: string[]}}[]}[];
  evidence: {recordId: string}[];
};
export type FunnelCounts = {paidSessions: number; view_item: number; add_to_cart: number; begin_checkout: number; purchase: number; returnPurchases?: number};
export type FeedbackCounts = {count: number; total: number; orderLinked: number; recordIds: string[]};
export function channelContributions(periods: ContributionPeriod[]): {channel: string; withinChange: number | null; mixChange: number | null; shareOfDecline: number | null}[];
export function deviceFunnels(records: Record<string, unknown>[], report: Pick<DiagnosisReport, 'asOf' | 'periods'>, channel?: string): {device: 'mobile' | 'desktop'; before: FunnelCounts; after: FunnelCounts}[];
export function deviceEvidence<T extends Record<string, unknown>>(records: T[], report: Pick<DiagnosisReport, 'asOf' | 'periods'>, channel: string, device: 'mobile' | 'desktop'): T[];
export function feedbackComparison(records: Record<string, unknown>[], report: DiagnosisReport): {topic: 'shipping' | 'checkout'; label: string; before: FeedbackCounts; after: FeedbackCounts}[];
export type StagePeriodDiagnosis = {
 cost:{impressions:number|null;clicks:number|null;spend:number|null;ctr:number|null;cpm:number|null;cpc:number|null};
 revenue:{orders:number|null;units:number|null;unitPrice:number|null;discountPerOrder:number|null;revenuePerOrder:number|null};
 refund:{revenueBeforeAdjustments:number|null;adjustments:number|null;adjustmentRate:number|null};
 evidenceIds:{cost:string[];revenue:string[];refund:string[]};unavailable:string[];
};
export type StageDiagnosisResult={before:StagePeriodDiagnosis;after:StagePeriodDiagnosis;limitations:string[]};
export function stageDiagnosis(records:Record<string,unknown>[],report:Pick<DiagnosisReport,'asOf'|'periods'>,channel?:string,device?:string):StageDiagnosisResult;
