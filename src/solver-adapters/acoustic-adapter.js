// Frequency-domain / transient acoustic execution (moved verbatim from analysis.worker.js solve()).
import {modalNormalVelocity} from '../vibration-source.js';
import {solveAcousticTransient} from '../acoustic-transient.js';
import {acousticFarField} from '../acoustic-far-field.js';
import {solveAcoustic} from '../acoustic-core.js';
import {acousticSweep} from '../acoustic-sweep.js';
export const acousticAdapter={kind:"acoustic",progressMessage:"Solving frequency-domain acoustics…",async execute(ctx){const {data,mesh,boundary,progress,observe,matvecFactory,loadMfem,setStage}=ctx;
 let result;
 const study={...data.project.study,method:data.options.method,...(data.project.study.exteriorRadiation?{radiationBoundary:{centerMm:data.source.enclosure.center,radiusMm:data.source.enclosure.radius}}:{})};const coupled=study.vibrationSource?modalNormalVelocity(study.vibrationSource,mesh,data.source.solid):null;if(coupled){if(boundary.acousticPressures?.length||boundary.impedance?.length)throw Error('Modal sound prototype uses the complete solid surface; remove manual acoustic boundary conditions');boundary.normalVelocity=coupled.normalVelocity;}result=study.acousticTransient?solveAcousticTransient(mesh,boundary,study,{matvecFactory,onProgress:progress,onObserve:observe,observeFields:data.observe===true&&data.observeFields===true}):solveAcoustic(mesh,boundary,{...study,matvecFactory,onObserve:observe});if(coupled)result.coupling=coupled.metadata;if(study.sweep)result.sweep=acousticSweep(mesh,boundary,study,{matvecFactory,onProgress:progress,onObserve:observe});if(study.directivityEnabled){progress('Computing exterior far-field directivity…');result.farField=acousticFarField(mesh,result,{axis:study.directivityAxis,count:study.directivityPoints,referenceDistanceM:study.directivityDistanceMm*.001});}
 return result;
}};
