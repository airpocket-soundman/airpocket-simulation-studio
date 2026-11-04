import {pathToFileURL} from 'node:url';
import {parsePrintedIdentificationArgs,writePrintedIdentificationFiles,printedIdentificationCliError} from './printed-identification-file-service.mjs';

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const summary=await writePrintedIdentificationFiles(parsePrintedIdentificationArgs(process.argv.slice(2)));console.log(JSON.stringify(summary));process.exitCode=summary.status==='identified'?0:2;}
 catch(error){console.log(JSON.stringify(printedIdentificationCliError(error)));process.exitCode=1;}
}
