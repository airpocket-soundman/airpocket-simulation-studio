import {encodeFiniteViscoInputHistory,replayFiniteViscoInputHistory,type FiniteViscoInputHistory} from '../../src/finite-visco-history.js';
const history:FiniteViscoInputHistory={schemaVersion:1,model:'synthetic-green-lagrange-maxwell-reference-v1',kind:'finite-visco-input-history',synthetic:true,provisional:true,calibrated:false,units:{time:'s',deformationGradient:'dimensionless'},parameters:{bulkModulusPa:2e6,equilibriumShearModulusPa:1e6,branchShearModulusPa:5e5,relaxationTimeSeconds:2},steps:[{F:[[1,0,0],[0,1,0],[0,0,1]],dtSeconds:1}]};
const saved=await encodeFiniteViscoInputHistory(history),result=await replayFiniteViscoInputHistory(saved.json);
if(result.completed){const time:number=result.finalState.timeSeconds;void time;}else{
 const index:number|null=result.failure.stepIndex;void index;
 // @ts-expect-error failed replay has no final state
 result.finalState;
}
// @ts-expect-error not calibrated or another version
const bad:FiniteViscoInputHistory={...history,calibrated:true};void bad;
// @ts-expect-error no object-state restore API
replayFiniteViscoInputHistory(history);
// @ts-expect-error readonly input steps
history.steps[0].dtSeconds=2;
