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
import {throwIfRule} from '../execution-combination-rules.js';
export const structuralConditionTypes=['fixed','displacement','force','pressure','normalTraction'];
const otherDisciplineMessage='Remove boundary conditions belonging to the other discipline or use the matching example';
// 'loaded': applies to every discipline (a non-structural study that carries orthotropic elasticity is rejected here).
export function validateLoaded(data){
 if(data.operation!=='mesh')throwIfRule('orthotropic-structural',data.project,data.options);
}
// 'configured', first part: structural-only features are rejected for every discipline, then the study validators run.
export function validateStudyFeatures(data){
 validatePlasticLoadFractions(data.project.study);
 if(data.project.study?.plasticLoadFractions!==undefined&&(data.project.study.kind!=='structural'||!data.project.materialProperties?.plasticity))throw Error('Plastic load fractions require a structural plasticity model');
 if(data.operation!=='mesh')throwIfRule('plasticity-structural',data.project,data.options);
 throwIfRule('modal-structural',data.project,data.options);
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
 throwIfRule('adaptive-non-structural',data.project,data.options);
 throwIfRule('gpu-mfem-non-structural',data.project,data.options);
}
// Structural-only, runs after the boundary-condition check (see structural-adapter).
export function validateHyperelasticCombination(data){if(data.operation!=='mesh')throwIfRule('hyperelastic-structural',data.project,data.options);}
export function validateMaterials(data){if(data.operation!=='mesh')validateMaterialProperties(data.project.materialProperties||{});}
// allowedTypes: array of accepted condition types, or null when the discipline accepts no boundary conditions at all.
export function validateConditionTypes(data,allowedTypes){
 if(data.operation!=='mesh'&&data.project.conditions.some(c=>allowedTypes===null?true:!allowedTypes.includes(c.type)))throw Error(otherDisciplineMessage);
}
