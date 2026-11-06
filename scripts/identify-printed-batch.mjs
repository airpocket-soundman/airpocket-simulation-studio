import {pathToFileURL} from 'node:url';
import {parsePrintedBatchArgs,writePrintedIdentificationBatch,printedBatchCliError} from './printed-identification-batch-service.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const summary=await writePrintedIdentificationBatch(parsePrintedBatchArgs(process.argv.slice(2)));console.log(JSON.stringify(summary));process.exitCode=summary.status==='identified'?0:2;}
 catch(error){console.log(JSON.stringify(printedBatchCliError(error)));process.exitCode=1;}
}
