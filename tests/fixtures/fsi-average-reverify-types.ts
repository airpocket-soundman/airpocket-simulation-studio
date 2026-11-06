import {verifyFsiAverageArtifact,type FsiReverifyManifest} from '../../scripts/fsi-average-reverify-service.mjs';
const manifest:FsiReverifyManifest={schemaVersion:1,artifact:{path:'/a.json',expectedSHA256:'0'.repeat(64)},tolerances:{relative:1e-8,absolute:{displacementM:0,velocityMPerS:0,arealEnergyJPerM2:0,tractionPa:0,tractionImpulsePaS:0,arealMomentumKgPerMS:0,dimensionless:0}}};void manifest;
const report=await verifyFsiAverageArtifact({request:'/verify.json'}),accuracy:false=report.physicalAccuracyVerified,originalRuntime:'not-recorded'=report.originalRuntime,sourceRecomputed:false=report.originalSourceRecomputed;void accuracy;void originalRuntime;void sourceRecomputed;
// @ts-expect-error tolerances must explicitly separate all seven quantities
const missing:FsiReverifyManifest={schemaVersion:1,artifact:manifest.artifact,tolerances:{relative:0,absolute:{displacementM:0}}};void missing;
// @ts-expect-error no worker executable or solver option can be provided by a caller
verifyFsiAverageArtifact({request:'/verify.json',worker:'other.mjs'});
