// Fully developed channel flow execution (moved verbatim from analysis.worker.js solve()).
import {solveChannelFlow} from '../channel-flow.js';
import {validateLoaded,validateStudyFeatures,validateConditionTypes,rejectAdaptiveAndGpuForNonStructural} from './validation.js';
export const channelFlowAdapter={kind:"channelFlow",progressMessage:"Solving fully developed channel flow…",
 validate({phase,data}){if(phase==='loaded')validateLoaded(data);else if(phase==='configured'){validateStudyFeatures(data);validateConditionTypes(data,null);rejectAdaptiveAndGpuForNonStructural(data);}},
 async execute(ctx){const {data,mesh,boundary,progress,observe,matvecFactory,loadMfem,setStage}=ctx;
 let result;
 result=solveChannelFlow(mesh,data.source,data.project.study,{matvecFactory,method:data.options.method,onObserve:observe});
 return result;
}};
