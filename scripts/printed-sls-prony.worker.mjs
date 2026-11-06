import {parentPort} from 'node:worker_threads';
import {runPrintedSlsPronyRoundtrip} from '../src/printed-sls-prony-roundtrip.js';
parentPort.once('message',async input=>{try{parentPort.postMessage({ok:true,result:await runPrintedSlsPronyRoundtrip(input)});}catch(error){parentPort.postMessage({ok:false,code:typeof error?.code==='string'&&/^PRINTED_[A-Z0-9_]+$/.test(error.code)?error.code:'PRINTED_SLS_PRONY_WORKER_ERROR'});}finally{parentPort.close();}});
