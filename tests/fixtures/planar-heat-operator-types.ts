import {buildPlanarHeatTransferOperator,applyPlanarHeatTransferOperator} from '../../src/planar-heat-operator.js';
import type {PlanarHeatOperatorGeometry} from '../../src/contracts/planar-heat-operator.js';
const geometry:PlanarHeatOperatorGeometry={units:'mm',mesh:{nodes:[]},sourceFaces:[],targetFaces:[]};
buildPlanarHeatTransferOperator(geometry).then(op=>{
 applyPlanarHeatTransferOperator(op,geometry,{base:1,gradient:[0,0,0]});
 // @ts-expect-error immutable trusted coefficient rows
 op.rows[0].coefficients[0]=2;
 // @ts-expect-error unsupported polynomial order
 applyPlanarHeatTransferOperator(op,geometry,{base:1,quadratic:[0,0,0]});
});
