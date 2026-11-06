import {parsePrintedIdentificationArgs,writePrintedIdentificationFiles,printedIdentificationCliError,type PrintedIdentificationFileArtifact} from '../../scripts/printed-identification-file-service.mjs';
const paths=parsePrintedIdentificationArgs(['--dataset','/a.json','--options','/b.json','--output','/c.json']);
const result=await writePrintedIdentificationFiles(paths);
const calibrated:false=result.calibrated,accuracy:false=result.accuracyVerified,hash:string=result.outputSha256;void calibrated;void accuracy;void hash;
const e=printedIdentificationCliError(new Error());const status:'error'=e.status;void status;
declare const artifact:PrintedIdentificationFileArtifact;
if(artifact.result){const uncalibrated:false=artifact.result.calibrated;const provenance:'synthetic'|'measured'=artifact.result.dataset.provenance;void uncalibrated;void provenance;}
// @ts-expect-error no material/solver application flag
writePrintedIdentificationFiles({...paths,applyMaterial:true});
// @ts-expect-error three explicit paths are required
writePrintedIdentificationFiles({dataset:'/a.json',output:'/b.json'});
// @ts-expect-error a CLI result is not a calibration assertion
const calibration:true=result.calibrated;void calibration;
