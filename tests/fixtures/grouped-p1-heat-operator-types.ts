import {buildGroupedP1HeatTransferOperator,applyGroupedP1HeatTransferOperator,loadGroupedP1HeatTransferOperator,serializeGroupedP1HeatTransferOperator,GROUPED_P1_HEAT_OPERATOR_LIMITS} from '../../src/grouped-p1-heat-operator.js';
import type {GroupedP1HeatGeometry,GroupedP1HeatFlux} from '../../src/grouped-p1-heat-operator.js';
export async function groupedP1HeatFixture(g:GroupedP1HeatGeometry,q:GroupedP1HeatFlux){const op=await buildGroupedP1HeatTransferOperator(g);const raw=serializeGroupedP1HeatTransferOperator(op);const restored=await loadGroupedP1HeatTransferOperator(raw,g);const result=await applyGroupedP1HeatTransferOperator(restored.operator,g,q);const loads:Map<number,number>=result.nodeHeatW;const disconnected:false=result.solverConnected;const cap:128=GROUPED_P1_HEAT_OPERATOR_LIMITS.activeNodesPerSide;
// @ts-expect-error Heat flux uses explicit W/m2, not temperature.
const bad:GroupedP1HeatFlux={units:'K',groups:[]};void bad;return {loads,disconnected,cap};}
