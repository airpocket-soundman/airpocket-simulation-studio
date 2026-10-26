import type {FiniteHistoryReport} from './contracts/finite-history-inspector.js';
export declare function inspectFiniteHistory(raw:string|Uint8Array):Promise<FiniteHistoryReport>;
import type {FiniteViscoFinalSyntheticComparison} from './finite-visco-observation-comparison.js';
export declare function compareFiniteHistoryObservation(historyRaw:string|Uint8Array,observationRaw:string|Uint8Array):Promise<FiniteViscoFinalSyntheticComparison>;
