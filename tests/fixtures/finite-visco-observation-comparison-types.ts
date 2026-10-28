import {compareFiniteViscoFinalObservation,type FiniteViscoFinalSyntheticObservation} from '../../src/finite-visco-observation-comparison.js';
import type {FiniteViscoFinalSyntheticComparison} from '../../src/contracts/finite-visco-observation-comparison';
const observation:FiniteViscoFinalSyntheticObservation={schemaVersion:1,kind:'finite-visco-final-synthetic-observation',model:'synthetic-green-lagrange-maxwell-reference-v1',synthetic:true,provisional:true,calibrated:false,units:{time:'s',stress:'Pa',energyDensity:'J/m3-reference'},historyIdentity:{rawIdentity:'sha256:...',canonicalIdentity:'sha256:...'},parameterRevision:'sha256:...',timeSeconds:1,origin:{kind:'synthetic-reference',description:'Synthetic only'},values:{S:[[0,0,0],[0,0,0],[0,0,0]],energyDensity:0,cumulativeDissipationDensity:0}};
const result:FiniteViscoFinalSyntheticComparison=await compareFiniteViscoFinalObservation('{}',JSON.stringify(observation));
if(result.completed){const pa:'Pa'=result.stress.unit;const energy:'J/m3-reference'=result.energy.unit;void [pa,energy];}else{const index:number|null=result.failure.stepIndex;void index;}
// @ts-expect-error Objects are not raw byte inputs.
compareFiniteViscoFinalObservation('{}',observation);
// @ts-expect-error This synthetic boundary cannot assert calibration.
const calibrated:FiniteViscoFinalSyntheticObservation={...observation,calibrated:true};void calibrated;
// @ts-expect-error Cauchy stress is not the declared second Piola observation field.
const cauchy:FiniteViscoFinalSyntheticObservation={...observation,values:{sigma:[[0,0,0],[0,0,0],[0,0,0]],energyDensity:0,cumulativeDissipationDensity:0}};void cauchy;
