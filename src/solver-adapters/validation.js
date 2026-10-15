// Pre-dispatch validation guards shared by the solver adapters (moved verbatim from analysis.worker.js).
// The worker calls `adapter.validate({phase,data})` at the three points where the checks used to live:
//   'pre-load'   before the gmsh module is imported
//   'loaded'     right after the gmsh module is imported
//   'configured' after the "Simulation modules loaded" observation, before the mesh/solve closures are built
// Throw order inside a phase is part of the contract (several rules can fire at once); keep it unchanged.
import {validatePlasticLoadFractions} from '../regions.js';
import {validateVibrationStudy} from '../vibration-source.js';
import {validateTransientAcousticStudy} from '../acoustic-transient.js';
import {validateFarFieldStudy} from '../acoustic-far-field.js';
import {validateMaterialProperties} from '../materials.js';
import {analysisError} from '../analysis-failure.js';
const gpuOrMfem=m=>['webgpu-pcg','mfem-wasm'].includes(m);
export const structuralConditionTypes=['fixed','displacement','force','pressure','normalTraction'];
const otherDisciplineMessage='Remove boundary conditions belonging to the other discipline or use the matching example';
// 'loaded': applies to every discipline (a non-structural study that carries orthotropic elasticity is rejected here).
export function validateLoaded(data){
 if(data.operation!=='mesh'&&data.project.materialProperties?.orthotropic&&(data.project.study?.kind!=='structural'||data.project.study?.modalAnalysis||data.project.study?.thermalStress||!['pcg','pcg-strict','wasm-pcg'].includes(data.options.method)))throw Error('Orthotropic elasticity requires static linear CPU structure without thermal stress');
}
// 'configured', first part: structural-only features are rejected for every discipline, then the study validators run.
export function validateStudyFeatures(data){
 validatePlasticLoadFractions(data.project.study);
 if(data.project.study?.plasticLoadFractions!==undefined&&(data.project.study.kind!=='structural'||!data.project.materialProperties?.plasticity))throw Error('Plastic load fractions require a structural plasticity model');
 if(data.operation!=='mesh'&&data.project.materialProperties?.plasticity&&(data.project.study?.modalAnalysis||data.options.adaptive||gpuOrMfem(data.options.method)||data.project.study?.thermalStress))throw Error('Plasticity supports CPU structure without adaptation, modal analysis or thermal stress');
 if(data.project.study?.modalAnalysis&&(data.project.study.kind!=='structural'||data.project.study.thermalStress||data.project.materialProperties?.hyperelastic||data.options.adaptive||gpuOrMfem(data.options.method)||data.project.study.gravityEnabled!==false&&data.project.study.gravity?.some(v=>v!==0)))throw Error('Modal prototype requires linear CPU structure, homogeneous supports and no gravity, thermal stress or adaptation');
 validateFarFieldStudy(data.project.study||{});validateTransientAcousticStudy(data.project.study||{});validateVibrationStudy(data.project.study||{});
}
// Assessments are structural-only. The worker calls this shared guard at the
// postprocess boundary now that evaluation belongs to the selected adapter.
// Tag the legacy stage so failure metadata remains stable.
export function validateAssessmentDiscipline(data){
 if(data.operation==='mesh'||data.project.study?.kind==='structural')return;
 if(data.options.fractureAssessment!==undefined)throw analysisError('ANALYSIS_POSTPROCESS_FAILED','Fracture assessment requires linear structural analysis',{stage:'postprocess'});
 if(data.options.fatigueAssessment!==undefined)throw analysisError('ANALYSIS_POSTPROCESS_FAILED','Fatigue assessment requires uniaxial elastic structure without thermal stress',{stage:'postprocess'});
}
// 'configured', last part for every non-structural discipline (after its boundary-condition check).
export function rejectAdaptiveAndGpuForNonStructural(data){
 if(data.options.adaptive)throw Error('Adaptive refinement currently supports structural analysis only');
 if(gpuOrMfem(data.options.method))throw Error('WebGPU and MFEM currently support structural analysis only');
}
export function validateMaterials(data){if(data.operation!=='mesh')validateMaterialProperties(data.project.materialProperties||{});}
// allowedTypes: array of accepted condition types, or null when the discipline accepts no boundary conditions at all.
export function validateConditionTypes(data,allowedTypes){
 if(data.operation!=='mesh'&&data.project.conditions.some(c=>allowedTypes===null?true:!allowedTypes.includes(c.type)))throw Error(otherDisciplineMessage);
}
