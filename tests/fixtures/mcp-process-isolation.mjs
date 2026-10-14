import {fork} from 'node:child_process';
import {configureAnalysisExecution,startServer} from '../../scripts/studio-mcp.mjs';
import {createAnalysisProcessWorker} from '../../scripts/analysis-process-worker.mjs';
let count=0;configureAnalysisExecution({isolation:'process',createProcessWorker:options=>createAnalysisProcessWorker({...options,forkImpl:(entry,args,settings)=>fork(++count===1?new URL('./analysis-process-exit.mjs',import.meta.url):entry,args,settings)})});startServer();
