// Heat conduction execution (moved verbatim from analysis.worker.js solve()).
import {solveThermal} from '../thermal-core.js';
export const thermalAdapter={kind:"thermal",progressMessage:"Solving heat conduction…",async execute(ctx){const {data,mesh,boundary,progress,observe,matvecFactory,loadMfem,setStage}=ctx;
 let result;
 result=solveThermal(mesh,data.project.materialProperties,boundary,{...data.project.study,...data.options,matvecFactory,onObserve:observe,observeFields:data.observe===true&&data.observeFields===true});
 return result;
}};
