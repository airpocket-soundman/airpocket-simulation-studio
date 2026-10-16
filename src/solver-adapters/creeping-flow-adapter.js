// Creeping Stokes flow execution (moved verbatim from analysis.worker.js solve()).
import {solveStokes} from '../stokes-core.js';
import {solveStokesP2} from '../stokes-p2-core.js';
import {stokesBoundary} from '../stokes-study.js';
import {validateProject} from '../regions.js';
import {validateStokesStudy} from '../stokes-study.js';
import {validateLoaded,validateStudyFeatures,validateConditionTypes,rejectAdaptiveAndGpuForNonStructural} from './validation.js';
export const creepingFlowAdapter={kind:"creepingFlow",skipsBoundaryTransfer:true,progressMessage:"Solving three-dimensional creeping Stokes flow…",
 validate({phase,data}){if(phase==='pre-load'){validateProject(data.project);validateStokesStudy(data.project.study);if(!['wasm-pcg','pcg','pcg-strict'].includes(data.options.method))throw Error('Stokes supports Airpocket CPU solvers only');}else if(phase==='loaded')validateLoaded(data);else if(phase==='configured'){validateStudyFeatures(data);validateConditionTypes(data,null);rejectAdaptiveAndGpuForNonStructural(data);}},
 // Discipline-specific mesh options merged after data.options in the worker's build(): Stokes caps the volume mesh at 8000 elements.
 buildOptions({data}){return {maxElements:Math.min(8000,data.options.maxElements??8000)};},
 async execute(ctx){const {data,mesh,boundary,progress,observe,matvecFactory,loadMfem,setStage}=ctx;
 let result;
 const b=stokesBoundary(mesh,data.source,data.project.study);result=(data.project.study.stokesVelocityElement==='P2'?solveStokesP2:solveStokes)(mesh,{dynamicViscosity:data.project.study.dynamicViscosity,density:data.project.study.fluidDensity},b,{matvecFactory,referenceLengthMm:b.referenceLengthMm,referenceVelocity:data.project.study.freeStreamVelocity,onProgress:progress,onObserve:observe});
 return result;
}};
