import {createIncrementCurveBundle,type IncrementCurveBundleRequest} from '../../scripts/increment-curve-bundle-service.mjs';
import type {IncrementCurveMcpRow} from '../../src/contracts/increment-curve-mcp';
declare const common:Omit<IncrementCurveBundleRequest,'controlledQuantity'|'loadsN'|'displacementsMm'>;
const force:IncrementCurveBundleRequest={...common,loadsN:[0,10]};
const displacement:IncrementCurveBundleRequest={...common,controlledQuantity:'displacement',displacementsMm:[0,.04,0,-.02]};
// @ts-expect-error a displacement request must not carry simultaneous nodal loads
const mixed:IncrementCurveBundleRequest={...common,controlledQuantity:'displacement',displacementsMm:[.04],loadsN:[100]};
// @ts-expect-error explicit displacement mode is required
const implicit:IncrementCurveBundleRequest={...common,displacementsMm:[.04]};
const mm:IncrementCurveMcpRow={stepIndex:0,stepId:'u0',controlledQuantity:'displacement',controlledUnit:'mm',controlledValue:.04,converged:true,provisional:false,status:'converged'};
// @ts-expect-error force/displacement units are correlated with the control quantity
const wrongUnit:IncrementCurveMcpRow={...mm,controlledUnit:'N'};
const promise=createIncrementCurveBundle(displacement);
void [force,displacement,mixed,implicit,mm,wrongUnit,promise];
