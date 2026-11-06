import {preparePrintedInputPath,preparePrintedOutputPath,printedPathKey} from './printed-identification-file-io.mjs';
import {readSavedSlsReport,publishSavedSlsArtifact} from './printed-sls-report-file-io.mjs';
import {createPrintedSlsReportArtifact} from '../src/printed-sls-report-artifacts.js';
const fail=reason=>{throw Object.assign(Error(reason),{code:'PRINTED_SLS_REPORT_FILE_INVALID'});};
/** Optional outputPath writes only a new native artifact, never a source report or dataset. */
export async function readPrintedSlsReportArtifact(request){
 if(!request||typeof request!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(request)))fail('request');const names=['reportPath','expectedSHA256','query',...(Object.hasOwn(request,'outputPath')?['outputPath']:[])];if(Reflect.ownKeys(request).length!==names.length)fail('request');const copy={};for(const key of names){const d=Object.getOwnPropertyDescriptor(request,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('own-data');copy[key]=d.value;}
 const q=copy.query,query={};if(!q||typeof q!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(q))||Reflect.ownKeys(q).length!==5)fail('query');for(const key of ['pairIndex','role','format','offset','limit']){const d=Object.getOwnPropertyDescriptor(q,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('query');query[key]=d.value;}
 const source=await preparePrintedInputPath(copy.reportPath),output=Object.hasOwn(copy,'outputPath')?await preparePrintedOutputPath(copy.outputPath):null;if(output&&printedPathKey(output)===printedPathKey(source.path))fail('alias');const rawReport=await readSavedSlsReport(source),result=await createPrintedSlsReportArtifact({rawReport,expectedSHA256:copy.expectedSHA256,query});
 if(output){if(Buffer.byteLength(JSON.stringify(result))+Buffer.byteLength(JSON.stringify(output))+512>65536)fail('response-limit');result.publication=await publishSavedSlsArtifact(output,result.artifact.text);}if(Buffer.byteLength(JSON.stringify(result))>65536)fail('response-limit');return result;
}
