import {runChannelAverageForce,type AverageForceInput,AVERAGE_FORCE_LIMITS} from '../../src/fsi-channel-average-force.js';
const input:AverageForceInput={schemaVersion:1,method:'time-averaged-midpoint',fluid:{cellsY:8,height:1,density:1,kinematicViscosity:.1},plate:{mass:.5,stiffness:2},initialDisplacement:.1,dt:.01,steps:2,microsteps:4};
const result=runChannelAverageForce(input),uncalibrated:false=result.calibrated,synthetic:true=result.synthetic,limit:2000000=AVERAGE_FORCE_LIMITS.cellSteps;void uncalibrated;void synthetic;void limit;
// @ts-expect-error this explicit method is not a legacy Aitken mode
runChannelAverageForce({...input,method:'aitken'});
// @ts-expect-error result restoration is not an input contract
runChannelAverageForce({...input,history:result.history});
// @ts-expect-error typed-array profiles are deliberately outside this JSON-input boundary
runChannelAverageForce({...input,initialProfile:new Float64Array(8)});
