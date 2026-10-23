import {buildPlanarP1HeatTransferOperator,applyPlanarP1HeatTransferOperator,loadPlanarP1HeatTransferOperator,type PlanarP1HeatGeometry,type PlanarP1HeatFlux} from '../../src/planar-p1-heat-operator.js';
const g:PlanarP1HeatGeometry={units:'mm',mesh:{nodes:[]},sourceFaces:[{nodes:[0,1,2]}],targetFaces:[{nodes:[3,5,4]}]},q:PlanarP1HeatFlux={units:'W/m2',values:[{nodeId:0,value:1}]};
const op=await buildPlanarP1HeatTransferOperator(g),r=await applyPlanarP1HeatTransferOperator(op,g,q);const watts:number=r.targetW;void watts;
const loaded=await loadPlanarP1HeatTransferOperator('{}',g);applyPlanarP1HeatTransferOperator(loaded.operator,g,q);
// @ts-expect-error P1 is not an affine basis coefficient field
applyPlanarP1HeatTransferOperator(op,g,{base:1,gradient:[0,0,0]});
// @ts-expect-error flux density is not nodal load
const wrongUnit:PlanarP1HeatFlux={units:'W',values:[]};void wrongUnit;
// @ts-expect-error immutable compiled coefficients
op.rows[0].terms[0].coefficientM2=1;
// @ts-expect-error loader wrapper is not the trusted operator itself
applyPlanarP1HeatTransferOperator(loaded,g,q);
