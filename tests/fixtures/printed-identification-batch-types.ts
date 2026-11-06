import {writePrintedIdentificationBatch,parsePrintedBatchArgs,PRINTED_IDENTIFICATION_BATCH_LIMITS,type PrintedBatchManifest,type PrintedBatchArtifact} from '../../scripts/printed-identification-batch-service.mjs';
const manifest:PrintedBatchManifest={schemaVersion:1,entries:[{id:'A',dataset:{path:'/a.json',expectedSHA256:'0'.repeat(64)},options:{path:'/b.json',expectedSHA256:'1'.repeat(64)}}]};void manifest;
const request=parsePrintedBatchArgs(['--manifest','/manifest.json','--output','/result.json']),summary=await writePrintedIdentificationBatch(request);
const falseCalibration:false=summary.calibrated,cap:8=PRINTED_IDENTIFICATION_BATCH_LIMITS.entries;void falseCalibration;void cap;
declare const artifact:PrintedBatchArtifact;if(artifact.entries[0]?.result){const noAccuracy:false=artifact.entries[0].result.accuracyVerified;void noAccuracy;}
// @ts-expect-error a batch cannot apply material values
writePrintedIdentificationBatch({...request,applyMaterial:true});
// @ts-expect-error manifest and new output paths are both required
writePrintedIdentificationBatch({manifest:'/a.json'});
// @ts-expect-error explicit version1 schema is required
const bad:PrintedBatchManifest={schemaVersion:2,entries:[]};void bad;
