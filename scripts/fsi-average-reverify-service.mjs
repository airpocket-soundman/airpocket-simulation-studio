import {runFsiAverageConfiguration,fsiAbortRequested} from './fsi-average-file-service.mjs';
import {publishJson} from './json-artifacts.mjs';
import {printedAbsolutePath,printedPathKey,preparePrintedInputPath,preparePrintedOutputPath,samePrintedFile,readPrintedInputSnapshot} from './printed-identification-file-io.mjs';
import {exact,canonical,parseFsiBoundedJson,decodeFsiUtf8,readFsiArtifactBytes,inspectFsiArtifact,BASE_HISTORY_FIELDS,STEP_HISTORY_FIELDS} from './fsi-average-artifact-format.mjs';

export const FSI_REVERIFY_LIMITS=Object.freeze({requestBytes:65536,artifactBytes:4194304,reportBytes:65536,mismatchPointers:8,relativeTolerance:1e-6,cellSteps:2000000});
const prefix='FSI_AVERAGE_REVERIFY_',fail=code=>{throw Object.assign(Error(prefix+code),{code:prefix+code});};
const groups=Object.freeze({displacementM:'m',velocityMPerS:'m/s',arealEnergyJPerM2:'J/m²',tractionPa:'Pa',tractionImpulsePaS:'Pa s',arealMomentumKgPerMS:'kg/(m s)',dimensionless:'1'});
const fieldGroup={d:'displacementM',v:'velocityMPerS',wallVelocity:'velocityMPerS',fluidEnergy:'arealEnergyJPerM2',plateEnergy:'arealEnergyJPerM2',dissipated:'arealEnergyJPerM2',interfaceWork:'arealEnergyJPerM2',energyDefectJPerM2:'arealEnergyJPerM2',stepDissipated:'arealEnergyJPerM2',stepInterfaceWork:'arealEnergyJPerM2',fluidEnergyDefectJPerM2:'arealEnergyJPerM2',plateEnergyDefectJPerM2:'arealEnergyJPerM2',forceOnPlate:'tractionPa',forceOnFluid:'tractionPa',forceResidualPa:'tractionPa',interfaceImpulse:'tractionImpulsePaS',bottomImpulse:'tractionImpulsePaS',momentumDefectKgPerMS:'arealMomentumKgPerMS',energyDefect:'dimensionless',scaledForceResidual:'dimensionless'};
function pathsSnapshot(o){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype)fail('ARGUMENTS');const keys=Reflect.ownKeys(o);if(keys.some(k=>!['request','output'].includes(k))||!Object.hasOwn(o,'request'))fail('ARGUMENTS');const p={};
 for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('ARGUMENTS');p[k]=printedAbsolutePath(d.value);}if(p.output&&printedPathKey(p.output)===printedPathKey(p.request))fail('PATH_ALIAS');return p;
}
export function parseFsiReverifyArgs(args){
 if(!Array.isArray(args)||![2,4].includes(args.length))fail('ARGUMENTS');const p={};for(let i=0;i<args.length;i+=2){if(!['--request','--output'].includes(args[i])||Object.hasOwn(p,args[i].slice(2)))fail('ARGUMENTS');p[args[i].slice(2)]=args[i+1];}return pathsSnapshot(p);
}
function optionsSnapshot(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail('ARGUMENTS');const copy={};for(const k of Reflect.ownKeys(value)){if(!['signal','timeoutMs'].includes(k))fail('ARGUMENTS');const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('ARGUMENTS');copy[k]=d.value;}
 if(copy.timeoutMs!==undefined&&(!Number.isSafeInteger(copy.timeoutMs)||copy.timeoutMs<1||copy.timeoutMs>120000))fail('ARGUMENTS');fsiAbortRequested(copy.signal);return copy;
}
function manifest(text){
 const p=parseFsiBoundedJson(text);exact(p,['schemaVersion','artifact','tolerances']);if(p.schemaVersion!==1)fail('VERSION');exact(p.artifact,['path','expectedSHA256']);p.artifact.path=printedAbsolutePath(p.artifact.path);
 if(typeof p.artifact.expectedSHA256!=='string'||!/^[a-f0-9]{64}$/.test(p.artifact.expectedSHA256))fail('ARGUMENTS');exact(p.tolerances,['relative','absolute']);exact(p.tolerances.absolute,Object.keys(groups));
 if(!Number.isFinite(p.tolerances.relative)||p.tolerances.relative<0||p.tolerances.relative>FSI_REVERIFY_LIMITS.relativeTolerance||Object.values(p.tolerances.absolute).some(v=>!Number.isFinite(v)||v<0))fail('TOLERANCE');return p;
}
function compare(saved,recomputed,tolerances){
 const stats=Object.fromEntries(Object.entries(groups).map(([k,unit])=>[k,{unit,compared:0,mismatches:0,maximumAbsoluteDifference:0,maximumThreshold:0}])),firstMismatches=[];let mismatches=0,exactNumericMatch=true;
 function value(a,b,group,pointer){
  const difference=Math.abs(a-b),threshold=tolerances.absolute[group]+tolerances.relative*Math.max(Math.abs(a),Math.abs(b));if(!Number.isFinite(difference)||!Number.isFinite(threshold))fail('NUMERIC_RANGE');
  const s=stats[group];s.compared++;s.maximumAbsoluteDifference=Math.max(s.maximumAbsoluteDifference,difference);s.maximumThreshold=Math.max(s.maximumThreshold,threshold);exactNumericMatch&&=a===b;
  if(difference>threshold){s.mismatches++;mismatches++;if(firstMismatches.length<8)firstMismatches.push({pointer,quantity:group,saved:a,recomputed:b,absoluteDifference:difference,threshold});}
 }
 value(saved.initialEnergy,recomputed.initialEnergy,'arealEnergyJPerM2','/result/initialEnergy');value(saved.maxXSpread,recomputed.maxXSpread,'velocityMPerS','/result/maxXSpread');
 for(let i=0;i<saved.profile.length;i++)value(saved.profile[i],recomputed.profile[i],'velocityMPerS','/result/profile/'+i);
 for(let i=0;i<saved.history.length;i++)for(const k of [...BASE_HISTORY_FIELDS,...(i?STEP_HISTORY_FIELDS:[])])if(k!=='t')value(saved.history[i][k],recomputed.history[i][k],fieldGroup[k],'/result/history/'+i+'/'+k);
 const lastSummary=r=>{const h=r.history.at(-1);return {timeSeconds:h.t,displacementM:h.d,velocityMPerS:h.v,fluidEnergyJPerM2:h.fluidEnergy,plateEnergyJPerM2:h.plateEnergy,dissipatedJPerM2:h.dissipated,energyDefectJPerM2:h.energyDefectJPerM2,relativeEnergyDefect:h.energyDefect};};
 const summary={saved:lastSummary(saved),recomputed:lastSummary(recomputed)};
 for(const [k,g]of Object.entries({displacementM:'displacementM',velocityMPerS:'velocityMPerS',fluidEnergyJPerM2:'arealEnergyJPerM2',plateEnergyJPerM2:'arealEnergyJPerM2',dissipatedJPerM2:'arealEnergyJPerM2',energyDefectJPerM2:'arealEnergyJPerM2',relativeEnergyDefect:'dimensionless'}))value(summary.saved[k],summary.recomputed[k],g,'/summary/'+k);
 return {comparison:{rule:'abs(saved-recomputed) <= absolute[quantity] + relative*max(abs(saved),abs(recomputed))',tolerances,exactNumericMatch,groups:stats,mismatches,firstMismatches,includesDerivedSummary:true},summary};
}
/** Recomputes exactly one explicit configuration; tolerance matches are not physical validation or authentication. */
export async function verifyFsiAverageArtifact(request,options={},dependencies={}){
 const paths=pathsSnapshot(request),runtime=optionsSnapshot(options);if(fsiAbortRequested(runtime.signal))fail('CANCELLED');const output=paths.output?await preparePrintedOutputPath(paths.output):null,requestSource=await preparePrintedInputPath(paths.request);
 const requestSnapshot=await readPrintedInputSnapshot(requestSource,65536),p=manifest(requestSnapshot.text),artifactSource=await preparePrintedInputPath(p.artifact.path);
 if(samePrintedFile(requestSource.stat,artifactSource.stat)||new Set([requestSource.path,artifactSource.path,...(output?[output]:[])].map(printedPathKey)).size!==(output?3:2))fail('PATH_ALIAS');
 const snapshot=await readFsiArtifactBytes(artifactSource);if(snapshot.identity.sha256!==p.artifact.expectedSHA256)fail('SHA_MISMATCH');const artifact=parseFsiBoundedJson(decodeFsiUtf8(snapshot.bytes),true),admitted=inspectFsiArtifact(artifact);
 const replayed=await runFsiAverageConfiguration(JSON.stringify(admitted.input),runtime,dependencies);
 if(fsiAbortRequested(runtime.signal))fail('CANCELLED');if(canonical(replayed.result.work)!==canonical(artifact.result.work))fail('WORK');
 const diagnostics=compare(artifact.result,replayed.result,p.tolerances),report={schemaVersion:1,kind:'fsi-average-reverification',status:diagnostics.comparison.mismatches?'mismatch':'matched',synthetic:true,calibrated:false,physicalAccuracyVerified:false,authenticationVerified:false,methodVersion:1,
  verificationRequest:requestSnapshot.identity,artifact:snapshot.identity,originalRequest:artifact.source,originalSourceRecomputed:false,originalRuntime:'not-recorded',replayRuntime:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},configurationSha256:artifact.configurationSha256,...diagnostics,replay:{worker:replayed.worker,work:replayed.result.work},
  limitations:['Match means only the explicitly declared numerical tolerances','Original raw request text and runtime identity are absent from methodVersion1 artifacts','No signature, calibration, physical accuracy or general equilibrium guarantee','Time/configuration/work/metadata are exact; no interpolation']};
 if(Buffer.byteLength(JSON.stringify(report))+1>65536)fail('REPORT_LIMIT');if(fsiAbortRequested(runtime.signal))fail('CANCELLED');
 if(output){const prospective={...report,publication:{output,outputBytes:Buffer.byteLength(JSON.stringify(report))+1,outputSha256:'0'.repeat(64),cleanupWarning:{code:'ARTIFACT_TEMP_CLEANUP_FAILED'}}};if(Buffer.byteLength(JSON.stringify(prospective))+1>65536)fail('REPORT_LIMIT');let integrity;try{integrity=await publishJson(output,report,{includeIntegrity:true});}catch(e){if(e.code==='EEXIST')fail('OUTPUT_EXISTS');throw e;}return {...report,publication:{output,outputBytes:integrity.outputBytes,outputSha256:integrity.outputSha256,...(integrity.cleanupWarning?{cleanupWarning:{code:'ARTIFACT_TEMP_CLEANUP_FAILED'}}:{})}};}return report;
}
export const fsiReverifyError=e=>({schemaVersion:1,kind:'fsi-average-reverification',status:'error',code:typeof e?.code==='string'&&/^(?:FSI_AVERAGE(?:_FILE|_REVERIFY)?|PRINTED_IDENTIFICATION)_[A-Z0-9_]+$/.test(e.code)?e.code:prefix+'IO'});
