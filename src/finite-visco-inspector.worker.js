import {compareFiniteViscoFinalObservation} from './finite-visco-observation-comparison.js';
import {replayFiniteViscoInputHistory} from './finite-visco-history.js';
/** A single owned worker replays one bounded synthetic input; issued state never crosses this boundary. */
export async function inspectFiniteHistory(raw){
 const result=await replayFiniteViscoInputHistory(raw);
 const {finalState,...report}=result;
 return report;
}
export async function compareFiniteHistoryObservation(historyRaw,observationRaw){return compareFiniteViscoFinalObservation(historyRaw,observationRaw);}
if(typeof globalThis.postMessage==='function')globalThis.onmessage=async event=>{
 try{globalThis.postMessage(await (event.data?.action==='compare'?compareFiniteHistoryObservation(event.data.raw,event.data.observationRaw):event.data?.action===undefined||event.data.action==='replay'?inspectFiniteHistory(event.data.raw):Promise.reject(Object.assign(Error('Unknown history action'),{code:'FINITE_VISCO_COMPARISON_INVALID_INPUT'}))));}
 catch(error){const code=typeof error?.code==='string'&&/^FINITE_VISCO_[A-Z_]{1,64}$/.test(error.code)?error.code:'FINITE_VISCO_HISTORY_INVALID_INPUT';globalThis.postMessage({completed:false,status:'invalid',failure:{code}});}
};
