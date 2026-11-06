import {parentPort,workerData} from 'node:worker_threads';
parentPort.once('message',()=>{if(workerData==='stderr')console.error('INDEPENDENT_WORKER_STDERR_MUST_NOT_ESCAPE');else console.log('INDEPENDENT_WORKER_STDOUT_MUST_NOT_ESCAPE');setTimeout(()=>parentPort.postMessage({ok:true,result:{}}),1000);});
