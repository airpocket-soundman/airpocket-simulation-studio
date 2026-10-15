// Creeping Stokes flow execution (moved verbatim from analysis.worker.js solve()).
import {solveStokes} from '../stokes-core.js';
import {solveStokesP2} from '../stokes-p2-core.js';
import {stokesBoundary} from '../stokes-study.js';
export const creepingFlowAdapter={kind:"creepingFlow",progressMessage:"Solving three-dimensional creeping Stokes flow…",async execute(ctx){const {data,mesh,boundary,progress,observe,matvecFactory,loadMfem,setStage}=ctx;
 let result;
 const b=stokesBoundary(mesh,data.source,data.project.study);result=(data.project.study.stokesVelocityElement==='P2'?solveStokesP2:solveStokes)(mesh,{dynamicViscosity:data.project.study.dynamicViscosity,density:data.project.study.fluidDensity},b,{matvecFactory,referenceLengthMm:b.referenceLengthMm,referenceVelocity:data.project.study.freeStreamVelocity,onProgress:progress,onObserve:observe});
 return result;
}};
