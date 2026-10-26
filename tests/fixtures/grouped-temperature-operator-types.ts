import {buildGroupedTemperatureOperator,applyGroupedTemperatureOperator,serializeGroupedTemperatureOperator,loadGroupedTemperatureOperator,GROUPED_TEMPERATURE_OPERATOR_LIMITS} from '../../src/grouped-temperature-operator.js';
import type {GroupedTemperatureGeometry} from '../../src/contracts/grouped-temperature-operator';
export async function groupedTemperatureFixture(g:GroupedTemperatureGeometry){const op=await buildGroupedTemperatureOperator(g);const r=await applyGroupedTemperatureOperator(op,g,{units:'K',values:[]});const unit:'degC*m2'|'K*m2'=r.integralUnits;const connected:false=r.solverConnected;const limit:8=GROUPED_TEMPERATURE_OPERATOR_LIMITS.groups;await loadGroupedTemperatureOperator(serializeGroupedTemperatureOperator(op),g);
// @ts-expect-error Global source temperatures cannot carry mixed row units.
await applyGroupedTemperatureOperator(op,g,{units:'K',values:[{nodeId:0,value:20,units:'degC'}]});
// @ts-expect-error Issued coefficients are immutable.
op.rows[0].coefficients[0]=2;
// @ts-expect-error Face assignments are indices, not inferred names.
g.groups[0].sourceFaceIds=['face0'];return {unit,connected,limit};}
