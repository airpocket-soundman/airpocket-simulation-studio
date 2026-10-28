import {pathToFileURL} from 'node:url';
import {parseIncrementCurveBundleArgs,writeIncrementCurveBundle} from './increment-curve-bundle-service.mjs';

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const summary=await writeIncrementCurveBundle(parseIncrementCurveBundleArgs(process.argv.slice(2)));console.log(JSON.stringify(summary));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
