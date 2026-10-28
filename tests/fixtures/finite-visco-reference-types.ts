import {initFiniteViscoReference,stepFiniteViscoReference,evaluateFiniteViscoReference,type ReferenceMatrix3} from '../../src/finite-visco-reference.js';
const parameters={bulkModulusPa:2e6,equilibriumShearModulusPa:1e6,branchShearModulusPa:5e5,relaxationTimeSeconds:2};
const state=initFiniteViscoReference({synthetic:true,provisional:true,calibrated:false,parameters});
const F:ReferenceMatrix3=[[1,0,0],[0,1,0],[0,0,1]],next=stepFiniteViscoReference({state,F,dtSeconds:1});
const pa:number=evaluateFiniteViscoReference({state:next.state,F}).S[0][0];void pa;
// @ts-expect-error never calibrated
initFiniteViscoReference({synthetic:true,provisional:true,calibrated:true,parameters});
// @ts-expect-error state is read-only
state.Z[0][0]=1;
// @ts-expect-error fabricated state is not issued
stepFiniteViscoReference({state:{model:'j2'},F,dtSeconds:1});
// @ts-expect-error explicit seconds, not milliseconds
stepFiniteViscoReference({state,F,dtMilliseconds:1});
