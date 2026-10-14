import {canonicalJson,getProjectRevision} from './project-revision.js';
import {prepareCaseView} from './case-view.js';
import {validateTemperatureSource} from './temperature-transfer.js';
import {validateVibrationSource,validateVibrationStudy} from './vibration-source.js';
import {inspectMesh} from './mesh-core.js';
import {createStudioApi} from './studio-api.js';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const copy=value=>JSON.parse(canonicalJson(value));
const hash=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
function command(value,allowed){if(!plain(value))throw Error('Invalid saved case source request');const result=copy(value);if(Object.keys(result).some(key=>!allowed.includes(key)))throw Error('Invalid saved case source request');return result;}
const keyFor=kind=>kind==='temperature'?'temperatureSource':kind==='vibration'?'vibrationSource':null;
function invalidate(project,key){for(const entry of project.inputProvenance?.entries??[])if(entry.pointer==='/study'||entry.pointer==='/study/'+key||entry.pointer.startsWith('/study/'+key+'/')){entry.status='unconfirmed';entry.assumption=null;delete entry.confirmation;}}
function prepared(reference){if(typeof reference?.name!=='string'||!reference.name.trim()||reference.name.length>100)throw Error('Invalid source case name');return prepareCaseView({output:structuredClone(reference.output)});}
/** No discipline, material, loading, frequency or amplitude is inferred. */
export function buildTemperatureCaseSource(project,reference){
 const next=copy(project),output=prepared(reference),s=next.study;
 if(s?.kind!=='structural'||s.thermalStress!==true||s.modalAnalysis||next.materialProperties?.plasticity||next.materialProperties?.hyperelastic||next.materialProperties?.orthotropic)throw Error('Temperature source requires explicit supported structural thermal stress settings');
 if(output.result.kind!=='thermal')throw Error('Choose a saved thermal case');
 if(!next.sourceModel||canonicalJson(next.sourceModel)!==canonicalJson(output.input.sourceModel))throw Error('Temperature source requires the exact same solid geometry');
 if((output.result.contactTransfers?.length||next.sourceModel.kind==='boxes'&&next.sourceModel.boxes.length>1)&&!output.mesh.nodeBodies)throw Error('Contact or multiple-solid temperature transfer requires matching body identifiers; legacy cases without them cannot be applied');
 const source={name:reference.name,mesh:{nodes:output.mesh.nodes,tetrahedra:output.mesh.tetrahedra,...(output.mesh.nodeBodies?{nodeBodies:output.mesh.nodeBodies}:{})},temperature:output.result.temperature};
 validateTemperatureSource(source);inspectMesh(source.mesh);next.study={...s,temperatureSource:source};invalidate(next,'temperatureSource');return next;
}
export function buildVibrationCaseSource(project,reference,options){
 const settings=command(options,['modeIndex','amplitudeMm','phaseDeg']),next=copy(project),output=prepared(reference),s=next.study,solid=output.input.sourceModel;
 if(!Number.isInteger(settings.modeIndex)||!Number.isFinite(settings.amplitudeMm)||!Number.isFinite(settings.phaseDeg))throw Error('Explicit modeIndex, amplitudeMm and phaseDeg are required');
 const mode=output.result.modes?.[settings.modeIndex];
 if(output.result.kind!=='modal'||!mode||solid?.kind!=='box'||next.sourceModel?.kind!=='fluidDomain'||next.sourceModel.mode==='internal'||canonicalJson(next.sourceModel.solid)!==canonicalJson(solid))throw Error('Modal sound requires the unchanged saved box solid in an exterior fluid domain');
 if(s?.kind!=='acoustic'||s.exteriorRadiation!==true||s.acousticTransient||s.sweep||s.frequency!==mode.frequencyHz)throw Error('Explicit exterior frequency acoustics must match the selected saved mode frequency');
 if(next.conditions.some(c=>['acousticPressure','acousticImpedance'].includes(c.type)))throw Error('Modal sound requires removal of manual acoustic pressure and impedance conditions');
 const source={name:reference.name,...settings,mesh:{nodes:output.mesh.nodes,tetrahedra:output.mesh.tetrahedra},bounds:[...solid.bounds],displacement:[...mode.displacement],frequencyHz:mode.frequencyHz};
 validateVibrationSource(source);inspectMesh(source.mesh);next.study={...s,vibrationSource:source};validateVibrationStudy(next.study);invalidate(next,'vibrationSource');return next;
}
/** getCase is trusted host-only and returns data plus a synchronous assertCurrent
 * closure checking the original store identity/revision immediately before commit.
 * loadProject must validate and commit synchronously and atomically. */
export function createCaseSourceOperations({studio,getCase,normalizeProject=project=>project,isBusy=()=>false}={}){
 if(typeof studio?.exportProject!=='function'||typeof studio?.loadProject!=='function'||typeof getCase!=='function'||typeof normalizeProject!=='function'||typeof isBusy!=='function')throw TypeError('Saved case source operations require host adapters');
 let locked=false;
 const check=guard=>{if(typeof guard!=='function'||!guard())throw Error('Saved case source permission expired');if(isBusy())throw Error('Studio is busy');};
 async function mutate(args,guard,build){
  if(locked)throw Error('Saved case source operation in progress');check(guard);locked=true;
  try{
   if(!hash(args.expectedRevision)||!keyFor(args.kind))throw Error('Invalid saved case source request');
   const before=copy(studio.exportProject()),serialized=canonicalJson(before),previousRevision=await getProjectRevision(before);
   check(guard);if(previousRevision!==args.expectedRevision)throw Error('Project revision conflict');if(canonicalJson(studio.exportProject())!==serialized)throw Error('Project changed during saved case source operation');
   const {project,assertCurrent,sourceCase}=await build(before);check(guard);
   if(normalizeProject.constructor?.name==='AsyncFunction')throw Error('Project normalization must be synchronous');
   const normalized=normalizeProject(structuredClone(project));if(normalized&&typeof normalized.then==='function'){Promise.resolve(normalized).catch(()=>{});throw Error('Project normalization must be synchronous');}
   const validation=createStudioApi();validation.loadProject(copy(normalized));const candidate=validation.exportProject(),response={schemaVersion:1,previousRevision,revision:await getProjectRevision(candidate),summary:validation.getSummary(),units:{geometry:'mm'},kind:args.kind,...(sourceCase?{applied:true,sourceCase}:{cleared:true})};
   if(assertCurrent){if(assertCurrent.constructor?.name==='AsyncFunction')throw Error('Case source assertion must be synchronous');const result=assertCurrent();if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw Error('Case source assertion must be synchronous');}}
   check(guard);if(canonicalJson(studio.exportProject())!==serialized)throw Error('Project changed during saved case source operation');
   studio.loadProject(candidate);return response;
  }finally{locked=false;}
 }
 return Object.freeze({isBusy:()=>locked||isBusy(),
  async apply(args,{guard=()=>true}={}){
   const frozen=command(args,['expectedRevision','caseId','caseRevision','kind','modeIndex','amplitudeMm','phaseDeg']);
   if(typeof frozen.caseId!=='string'||!frozen.caseId||!hash(frozen.caseRevision)||frozen.kind==='temperature'&&['modeIndex','amplitudeMm','phaseDeg'].some(key=>Object.hasOwn(frozen,key)))throw Error('Invalid saved case source request');
   return mutate(frozen,guard,async before=>{
    const host=await getCase({caseId:frozen.caseId,caseRevision:frozen.caseRevision},{guard});
    if(typeof host?.assertCurrent!=='function'||host.caseId!==frozen.caseId||host.revision!==frozen.caseRevision)throw Error('Source case identity or revision conflict');
    const reference=structuredClone({name:host.name,output:host.output}),project=frozen.kind==='temperature'?buildTemperatureCaseSource(before,reference):buildVibrationCaseSource(before,reference,{modeIndex:frozen.modeIndex,amplitudeMm:frozen.amplitudeMm,phaseDeg:frozen.phaseDeg});
    project.study[keyFor(frozen.kind)].caseReference={schemaVersion:1,caseId:frozen.caseId,revision:frozen.caseRevision};
    return {project,assertCurrent:host.assertCurrent,sourceCase:{caseId:host.caseId,revision:host.revision,name:reference.name,kind:reference.output.result.kind}};
   });
  },
  async clear(args,{guard=()=>true}={}){
   const frozen=command(args,['expectedRevision','kind']);return mutate(frozen,guard,before=>{const key=keyFor(frozen.kind),project=copy(before);project.study={...project.study};delete project.study[key];invalidate(project,key);return {project};});
  }
 });
}
