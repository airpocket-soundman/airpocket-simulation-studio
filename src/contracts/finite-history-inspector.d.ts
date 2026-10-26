import type {FiniteViscoHistoryReplay} from '../finite-visco-history.js';
export type FiniteHistoryReport = FiniteViscoHistoryReplay extends infer R ? R extends {finalState:unknown} ? Omit<R,'finalState'> : R : never;
export type FiniteHistoryPhase='idle'|'pending'|'completed'|'failed'|'invalid'|'cancelled'|'timeout'|'closed';
export interface FiniteHistoryInspector {panel:HTMLDetailsElement;input:HTMLTextAreaElement;run:HTMLButtonElement;example:HTMLButtonElement;cancel:HTMLButtonElement;clear:HTMLButtonElement;status:HTMLParagraphElement;results:HTMLDivElement;inspect():Promise<boolean>;invalidate():void;refresh():void;destroy():void;snapshot():{phase:FiniteHistoryPhase;rawIdentity:string|null;canonicalIdentity:string|null;workerActive:boolean};}
export declare const FINITE_HISTORY_INSPECTOR_LIMITS:Readonly<{inputBytes:1048576;steps:4096;workerMilliseconds:10000}>;
export declare function syntheticFiniteHistoryJson():string;
export declare function createFiniteHistoryInspector(options:{host:HTMLElement;document?:Document;language?:()=>string;createWorker?:()=>Worker;setTimer?:(callback:()=>void,milliseconds:number)=>ReturnType<typeof setTimeout>;clearTimer?:(id:ReturnType<typeof setTimeout>)=>void}):FiniteHistoryInspector;
