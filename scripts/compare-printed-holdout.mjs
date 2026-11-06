import {pathToFileURL} from 'node:url';
import {parsePrintedHoldoutArgs,writePrintedHoldoutFiles,printedHoldoutCliError} from './printed-holdout-file-service.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const r=await writePrintedHoldoutFiles(parsePrintedHoldoutArgs(process.argv.slice(2)));console.log(JSON.stringify(r));process.exitCode=r.status==='compared'?0:2;}
 catch(e){console.log(JSON.stringify(printedHoldoutCliError(e)));process.exitCode=1;}
}
