// Compatibility facade. UI imports the screen contract; source loading is isolated.
import typeMap from '../../docs/design/marketing-workbench-type-map.json';
import {source} from './baseline-source';
import {createLegacyQuery} from './legacy-query';
export {typeMap};
export * from './contract';
export * from './values';
export * from './presentation';
export * from './baseline-source';
export const buildModel=createLegacyQuery(source);
