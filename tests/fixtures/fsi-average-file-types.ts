import {writeFsiAverageFiles,parseFsiAverageArgs,type FsiAverageFileArtifact} from '../../scripts/fsi-average-file-service.mjs';
const paths=parseFsiAverageArgs(['--request','/a.json','--output','/b.json']);const summary=await writeFsiAverageFiles(paths,{signal:new AbortController().signal,timeoutMs:1000});
const synthetic:true=summary.synthetic,calibrated:false=summary.calibrated,exited:0=summary.worker.exitCode;void synthetic;void calibrated;void exited;
declare const artifact:FsiAverageFileArtifact;const profile:number[]=artifact.result.profile;void profile;
// @ts-expect-error user requests cannot supply executable worker factories
writeFsiAverageFiles({...paths,createWorker:()=>null});
// @ts-expect-error model options are stored in the strict JSON input, not runtime options
writeFsiAverageFiles(paths,{dt:1});
// @ts-expect-error both explicit paths are required
writeFsiAverageFiles({request:'/a.json'});
