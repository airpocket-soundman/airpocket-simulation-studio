import {createRequire,syncBuiltinESMExports} from 'node:module';
const require=createRequire(import.meta.url),threads=require('node:worker_threads'),Original=threads.Worker;
threads.Worker=class extends Original {constructor(url,options){super(new URL('./printed-prony-independent-noisy-worker.mjs',import.meta.url),{...options,workerData:process.argv[3]});}};
syncBuiltinESMExports();
const {writePrintedSlsPronyReport}=await import('../../scripts/printed-sls-prony-file-service.mjs');
try{const summary=await writePrintedSlsPronyReport(JSON.parse(process.argv[2]));console.log(JSON.stringify(summary));}catch(error){console.log(JSON.stringify({error:error.code}));process.exitCode=1;}
