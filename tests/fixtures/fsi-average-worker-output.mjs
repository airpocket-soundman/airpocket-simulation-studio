import {workerData} from 'node:worker_threads';
process[workerData.stream].write('unexpected-worker-output-do-not-forward\n');
setInterval(()=>{},1000);
