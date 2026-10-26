import {replayFiniteViscoInputHistory} from './finite-visco-history.js';
/** A single owned worker replays one bounded synthetic input; issued state never crosses this boundary. */
export async function inspectFiniteHistory(raw){
 const result=await replayFiniteViscoInputHistory(raw);
 const {finalState,...report}=result;
 return report;
}
if(typeof globalThis.postMessage==='function')globalThis.onmessage=async event=>{
 try{globalThis.postMessage(await inspectFiniteHistory(event.data?.raw));}
 catch(error){const code=typeof error?.code==='string'&&/^FINITE_VISCO_[A-Z_]{1,64}$/.test(error.code)?error.code:'FINITE_VISCO_HISTORY_INVALID_INPUT';globalThis.postMessage({completed:false,status:'invalid',failure:{code}});}
};
