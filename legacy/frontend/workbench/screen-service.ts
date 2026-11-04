import {source,products,months} from './baseline-source';
import {buildModel} from './adapter';
import {str} from './values';

// Screen controls receive selection metadata; raw data access stays in the query layer.
export const baselineService={query:buildModel,products,months,campaigns:source.T12.map(r=>({id:str(r,'campaign_id'),country:str(r,'country_code'),label:str(r,'platform')}))};
