// Heat conduction execution (moved verbatim from analysis.worker.js solve()).
import {solveThermal} from '../thermal-core.js';import {checkMaterialTemperature} from '../material-dependence.js';
import {validateLoaded,validateStudyFeatures,validateMaterials,validateConditionTypes,rejectAdaptiveAndGpuForNonStructural} from './validation.js';
export const thermalAdapter={kind:"thermal",progressMessage:"Solving heat conduction…",postprocess({data,result}){checkMaterialTemperature(data.project.materialProperties,result.temperature);if(data.project.study?.transient)checkMaterialTemperature(data.project.materialProperties,data.project.study.initialTemperature??20);for(const h of result.history||[])checkMaterialTemperature(data.project.materialProperties,[h.minTemperature,h.maxTemperature]);},
 validate({phase,data}){if(phase==='loaded')validateLoaded(data);else if(phase==='configured'){validateStudyFeatures(data);validateMaterials(data);validateConditionTypes(data,['temperature','heatFlux','heatPower','convection','radiation','thermalContact']);rejectAdaptiveAndGpuForNonStructural(data);}},
 async execute(ctx){const {data,mesh,boundary,progress,observe,matvecFactory,loadMfem,setStage}=ctx;
 let result;
 result=solveThermal(mesh,data.project.materialProperties,boundary,{...data.project.study,...data.options,matvecFactory,onObserve:observe,observeFields:data.observe===true&&data.observeFields===true});
 return result;
}};
