// Heat conduction execution (moved verbatim from analysis.worker.js solve()).
import {solveThermal} from '../thermal-core.js';
import {validateLoaded,validateStudyFeatures,validateMaterials,validateConditionTypes,rejectAdaptiveAndGpuForNonStructural} from './validation.js';
export const thermalAdapter={kind:"thermal",progressMessage:"Solving heat conduction…",
 validate({phase,data}){if(phase==='loaded')validateLoaded(data);else if(phase==='configured'){validateStudyFeatures(data);validateMaterials(data);validateConditionTypes(data,['temperature','heatFlux','heatPower','convection','radiation','thermalContact']);rejectAdaptiveAndGpuForNonStructural(data);}},
 async execute(ctx){const {data,mesh,boundary,progress,observe,matvecFactory,loadMfem,setStage}=ctx;
 let result;
 result=solveThermal(mesh,data.project.materialProperties,boundary,{...data.project.study,...data.options,matvecFactory,onObserve:observe,observeFields:data.observe===true&&data.observeFields===true});
 return result;
}};
