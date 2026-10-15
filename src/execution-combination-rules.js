// Shared, pure execution-combination rules. The worker validation (solver-adapters/validation.js,
// structural-adapter.js) throws `message` verbatim; diagnoseExecution (capabilities.js) reports the same
// combinations as structured diagnostics with the stable `code`. Keep messages byte-identical to the worker's.
// applies(project,options): `options.method` is the raw requested method (callers normalise any default first).
const cpuMethods=['pcg','pcg-strict','wasm-pcg'];
const gpuOrMfem=m=>['webgpu-pcg','mfem-wasm'].includes(m);
const study=p=>p?.study||{},mat=p=>p?.materialProperties;
export const executionCombinationRules=[
 // coveredBy: an existing inline diagnostic in capabilities.js already reports this condition with that code.
 {id:'orthotropic-structural',scope:{physics:['structural'],features:['orthotropic'],unsupportedWith:['non-structural study','modal','thermalStress','non-CPU method']},code:'MATERIAL_COMBINATION_UNSUPPORTED',coveredBy:'MATERIAL_COMBINATION_UNSUPPORTED',phase:'loaded',
  applies:(p,o)=>!!mat(p)?.orthotropic&&(study(p).kind!=='structural'||!!study(p).modalAnalysis||!!study(p).thermalStress||!cpuMethods.includes(o.method)),
  message:'Orthotropic elasticity requires static linear CPU structure without thermal stress',suggestions:['Use the documented CPU structural configuration; preserve the intended material model']},
 {id:'plasticity-structural',scope:{physics:['structural'],features:['plasticity'],unsupportedWith:['modal','adaptive','webgpu-pcg','mfem-wasm','thermalStress']},code:'MATERIAL_COMBINATION_UNSUPPORTED',coveredBy:'MATERIAL_COMBINATION_UNSUPPORTED',phase:'configured',
  applies:(p,o)=>!!mat(p)?.plasticity&&(!!study(p).modalAnalysis||!!o.adaptive||gpuOrMfem(o.method)||!!study(p).thermalStress),
  message:'Plasticity supports CPU structure without adaptation, modal analysis or thermal stress',suggestions:['Use CPU structure without adaptation, modal analysis or thermal stress; preserve the plasticity model']},
 {id:'modal-structural',scope:{physics:['structural'],features:['modalAnalysis'],unsupportedWith:['non-structural study','thermalStress','hyperelastic','adaptive','webgpu-pcg','mfem-wasm','gravity']},code:'MODAL_COMBINATION_UNSUPPORTED',phase:'configured',
  applies:(p,o)=>!!study(p).modalAnalysis&&(study(p).kind!=='structural'||!!study(p).thermalStress||!!mat(p)?.hyperelastic||!!o.adaptive||gpuOrMfem(o.method)||study(p).gravityEnabled!==false&&!!study(p).gravity?.some(v=>v!==0)),
  message:'Modal prototype requires linear CPU structure, homogeneous supports and no gravity, thermal stress or adaptation',suggestions:['Use linear CPU structure with homogeneous supports; disable gravity, thermal stress and adaptation for modal analysis']},
 {id:'hyperelastic-structural',scope:{physics:['structural'],features:['hyperelastic'],unsupportedWith:['adaptive','webgpu-pcg','mfem-wasm','thermalStress','pressure','normalTraction']},code:'HYPERELASTIC_COMBINATION_UNSUPPORTED',phase:'configured-structural',
  applies:(p,o)=>!!mat(p)?.hyperelastic&&(!!o.adaptive||gpuOrMfem(o.method)||!!study(p).thermalStress||(p.conditions||[]).some(c=>['pressure','normalTraction'].includes(c.type))),
  message:'Hyperelastic prototype supports CPU, dead forces, gravity and prescribed displacement; adaptive, follower pressure and thermal stress are unsupported',suggestions:['Use CPU with dead forces, gravity and prescribed displacement; avoid adaptive, follower pressure and thermal stress']},
 {id:'adaptive-non-structural',scope:{physics:['thermal','acoustic','channelFlow','creepingFlow','fluidDomain'],features:['adaptive'],unsupportedWith:[]},code:'ADAPTIVE_STUDY_UNSUPPORTED',coveredBy:'ADAPTIVE_STUDY_UNSUPPORTED',phase:'non-structural',
  applies:(p,o)=>!!o.adaptive&&(study(p).kind??'structural')!=='structural',
  message:'Adaptive refinement currently supports structural analysis only',suggestions:['Disable adaptive refinement']},
 {id:'gpu-mfem-non-structural',scope:{physics:['thermal','acoustic','channelFlow','creepingFlow','fluidDomain'],features:['webgpu-pcg','mfem-wasm'],unsupportedWith:[]},code:'ENGINE_STUDY_UNSUPPORTED',coveredBy:'ENGINE_STUDY_UNSUPPORTED',phase:'non-structural',
  applies:(p,o)=>gpuOrMfem(o.method)&&(study(p).kind??'structural')!=='structural',
  message:'WebGPU and MFEM currently support structural analysis only',suggestions:cpuMethods}
];
const byId=Object.fromEntries(executionCombinationRules.map(r=>[r.id,r]));
// Worker side: throw the rule's message when it applies (callers keep the operation!=='mesh' guard and ordering).
export function throwIfRule(id,project,options){const r=byId[id];if(r.applies(project,options))throw Error(r.message);}
// Diagnostic side: one structured issue per applicable rule that no inline diagnostic already covers.
export function diagnoseCombinationRules(project,options,makeIssue){
 return executionCombinationRules.filter(r=>!r.coveredBy&&r.applies(project,options)).map(r=>makeIssue(r.code,'execution.combination',r.message,{rule:r.id,method:options.method,adaptive:!!options.adaptive},r.suggestions));
}
// Capability side: bounded declarative summary derived from the table (message is the rule's own text; no separate JA/EN text exists).
export function describeCombinationRules(){return executionCombinationRules.map(r=>({id:r.id,code:r.code,phase:r.phase,summary:r.message,applies:{physics:[...r.scope.physics],features:[...r.scope.features],unsupportedWith:[...r.scope.unsupportedWith]},status:'unsupported'}));}
