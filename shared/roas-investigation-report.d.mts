import type {stageDiagnosis} from './roas-diagnosis.mjs';

type Investigation = {
  channel: 'all' | 'search' | 'social';
  device: 'all' | 'mobile' | 'desktop';
  stage: 'all' | 'cost' | 'checkout' | 'revenue' | 'refund';
  hypothesis: 'none' | 'guidance' | 'payment' | 'audience' | 'tracking';
  rationale: string;
  condition: string;
};
type Report = Parameters<typeof stageDiagnosis>[1] & {records: Record<string, unknown>[]; scenarioId?: string; purchaseTiming?: string};
export function renderInvestigationSummary(report: Report, investigation: Investigation): string;
