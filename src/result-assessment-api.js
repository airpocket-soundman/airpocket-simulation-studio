import {getProjectRevision} from './project-operations.js';
import {evaluateFatigue} from './fatigue-core.js';
import {evaluateFracture,validateFractureResult} from './fracture-core.js';
import {validateFatigueResult} from './fatigue-result.js';

const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,allowed)=>record(v)&&Object.keys(v).every(k=>allowed.includes(k));
const definitions={
 fatigue:{evaluate:evaluateFatigue,validate:validateFatigueResult,options:['minLoadFactor','maxLoadFactor','meanStressCorrection','appliedCycles'],arrays:['referenceStressPa','lifeCycles','damage','stressAmplitudePa','correctedAmplitudePa','meanStressPa','minimumStressPa','maximumStressPa','zeroAmplitude'],summary:['model','minLoadFactor','maxLoadFactor','meanStressCorrection','appliedCycles','minLifeCycles','maxDamage'],data:'fatigueData',limitations:['Proportional uniaxial linear elastic stress-life screening only.','Measured fully reversed S-N range only; no extrapolation or variable-amplitude history.','Miner damage is deterministic usage, not failure probability.'],units:{stress:'Pa',life:'cycles',damage:'dimensionless'}},
 fracture:{evaluate:evaluateFracture,validate:validateFractureResult,options:['flawSizeRangeMm','geometryFactorRange','geometrySource','crackNormal','residualNormalStressRangePa','stressAssumption'],arrays:['normalStressPa','intensityRangePaSqrtM','utilizationRange','criticalFlawRangeMm','classification'],summary:['model','options','maxUtilizationRange','counts'],data:'fractureData',limitations:['Mode-I linear elastic screening using uncracked nominal stress only; mixed-mode shear is rejected.','Flaw, geometry and residual stress ranges are deterministic bounds, not confidence intervals or failure probability.','No crack growth, fatigue crack propagation or remaining-life prediction.'],units:{stress:'Pa',intensity:'Pa sqrt(m)',flawSize:'mm',utilization:'dimensionless'}}
};
function definition(kind){if(!Object.hasOwn(definitions,kind))throw Error('Unsupported assessment kind');return definitions[kind];}
function scope(o){if(o?.input?.study?.kind!=='structural'||o.input.study.modalAnalysis||o.input.study.thermalStress||o.result?.kind!=='elastic'||!Array.isArray(o.mesh?.tetrahedra)||o.mesh.tetrahedra.length!==o.result.stresses?.length)throw Error('Assessment requires a matching structural linear elastic displayed result and original input');}
function describe(o,kind,revision){const d=definition(kind),a=o.result[kind];if(!a)throw Error('No stored '+kind+' assessment');return {schemaVersion:1,kind,available:true,resultRevision:revision,elementCount:o.result.stresses.length,summary:structuredClone(Object.fromEntries(d.summary.map(k=>[k,a[k]]))),provenance:structuredClone(a[d.data]),units:{...d.units},limitations:[...d.limitations],...(o.analysisAssessment||o.result.analysisAssessment?{analysisAssessment:structuredClone(o.analysisAssessment||o.result.analysisAssessment)}:{})};}

// commit(nextOutput) must synchronously and atomically replace the displayed
// output. No source reference or physical array is modified by this module.
export function createResultAssessmentApi({getAnalysis,commit,isBusy}){
 async function current(){const output=getAnalysis();if(!output?.result)throw Error('No displayed result');const serialized=JSON.stringify(output),snapshot=JSON.parse(serialized),revision=await getProjectRevision(snapshot);if(getAnalysis()!==output||JSON.stringify(output)!==serialized)throw Error('Displayed result changed during assessment');return {output,serialized,snapshot,revision};}
 const unchanged=c=>getAnalysis()===c.output&&JSON.stringify(c.output)===c.serialized;
 return Object.freeze({
  async evaluate(command={}, {guard=()=>true}={}){
   if(!keys(command,['expectedResultRevision','kind','options'])||typeof command.expectedResultRevision!=='string')throw Error('Invalid assessment command');
   const {expectedResultRevision,kind}=command,d=definition(kind),options=command.options===undefined?{}:structuredClone(command.options);
   if(!keys(options,d.options))throw Error('Invalid assessment options');
   if(isBusy?.()||!guard())throw Error('Assessment busy or command expired');
   const c=await current();if(c.revision!==expectedResultRevision)throw Error('Displayed result revision conflict');
   const next=c.snapshot;scope(next);
   next.result[kind]=d.evaluate(next.result,next.input.materialProperties,options);
   if(next.calculation!==undefined&&!record(next.calculation)||next.calculation?.options!==undefined&&!record(next.calculation.options))throw Error('Invalid saved calculation metadata');
   next.calculation={...next.calculation,options:{...next.calculation?.options,[kind+'Assessment']:options}};
   validateFatigueResult(next.mesh,next.result,next.input,next.calculation);validateFractureResult(next.mesh,next.result,next.input,next.calculation);
   const resultRevision=await getProjectRevision(next),response={...describe(next,kind,resultRevision),previousResultRevision:c.revision};
   if(!unchanged(c)||isBusy?.()||!guard())throw Error('Displayed result changed, assessment busy or command expired');
   commit(next);return response;
  },
  async get(command={}){
   if(!keys(command,['kind','expectedResultRevision','offset','limit']))throw Error('Invalid assessment query');
   const {kind,expectedResultRevision,offset=0,limit=50}=command,d=definition(kind);
   if(expectedResultRevision!==undefined&&typeof expectedResultRevision!=='string'||!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<0||limit>200)throw Error('Invalid assessment page or revision');
   const c=await current();if(expectedResultRevision!==undefined&&c.revision!==expectedResultRevision)throw Error('Displayed result revision conflict');scope(c.snapshot);d.validate(c.snapshot.mesh,c.snapshot.result,c.snapshot.input,c.snapshot.calculation);
   const a=c.snapshot.result[kind];
   if(a===undefined)return {schemaVersion:1,kind,resultRevision:c.revision,available:false,elementCount:c.snapshot.result.stresses.length,units:{...d.units},limitations:[...d.limitations],...(c.snapshot.analysisAssessment||c.snapshot.result.analysisAssessment?{analysisAssessment:structuredClone(c.snapshot.analysisAssessment||c.snapshot.result.analysisAssessment)}:{}),page:{offset,limit,total:0,elements:[]}};
   const out=describe(c.snapshot,kind,c.revision),total=out.elementCount,end=Math.min(total,offset+limit),elements=[];
   for(let index=offset;index<end;index++)elements.push({index,...Object.fromEntries(d.arrays.map(k=>[k,structuredClone(a[k][index])]))});
   return {...out,page:{offset,limit,total,elements}};
  }
 });
}
