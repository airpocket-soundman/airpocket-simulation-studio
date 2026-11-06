import {pathToFileURL} from 'node:url';
import {parseFsiAverageArgs,writeFsiAverageFiles,fsiAverageCliError} from './fsi-average-file-service.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const controller=new AbortController(),cancel=()=>controller.abort();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
 try{console.log(JSON.stringify(await writeFsiAverageFiles(parseFsiAverageArgs(process.argv.slice(2)),{signal:controller.signal})));}
 catch(e){console.log(JSON.stringify(fsiAverageCliError(e)));process.exitCode=1;}
 finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
}
