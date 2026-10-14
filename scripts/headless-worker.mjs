import {parentPort} from 'node:worker_threads';
import {initializeHeadlessWorker} from './headless-worker-environment.mjs';
const run=await initializeHeadlessWorker(message=>parentPort.postMessage(message));
parentPort.on('message',run);
