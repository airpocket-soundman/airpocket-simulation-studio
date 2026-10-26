import {buildPlanarTemperatureOperator,applyPlanarTemperatureOperator,serializePlanarTemperatureOperator,loadPlanarTemperatureOperator,PLANAR_TEMPERATURE_OPERATOR_LIMITS} from '../../src/planar-temperature-operator.js';
import type {PlanarHeatOperatorGeometry} from '../../src/contracts/planar-heat-operator';
export async function temperatureFixture(g:PlanarHeatOperatorGeometry){const o=await buildPlanarTemperatureOperator(g);const r=await applyPlanarTemperatureOperator(o,g,{units:'K',values:[]});const units:'degC*m2'|'K*m2'=r.integralUnits;const connected:false=r.solverConnected;const cap:128=PLANAR_TEMPERATURE_OPERATOR_LIMITS.activeNodesPerSide;await loadPlanarTemperatureOperator(serializePlanarTemperatureOperator(o),g);
// @ts-expect-error Mixed per-row units are not accepted.
await applyPlanarTemperatureOperator(o,g,{units:'K',values:[{nodeId:1,value:2,units:'degC'}]});
// @ts-expect-error Unsupported unit spelling.
await applyPlanarTemperatureOperator(o,g,{units:'C',values:[]});return {units,connected,cap};}
