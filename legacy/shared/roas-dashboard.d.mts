import type {DiagnosisReport} from './roas-diagnosis.mjs';
export function dashboardSeries(records:Record<string,unknown>[],report:Pick<DiagnosisReport,'asOf'|'periods'>&{daily:{date:string;channel:string;netRoas:number|null;recordId:string}[]},channel?:string,device?:string):({date:string}&Record<string,string|number|null>)[];
