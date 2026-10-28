import {test} from 'node:test';
import assert from 'node:assert/strict';
import {su2Capabilities,su2DiscreteMassFluxCapability,requireSu2DiscreteMassFlux,assessSu2Run} from '../scripts/su2-native.mjs';

test('SU2 discovery explicitly distinguishes nodal diagnostics from unavailable numerical boundary flux',()=>{
 const capabilities=su2Capabilities(),report=capabilities.discreteBoundaryMassFlux;
 assert.equal(report.supported,false);assert.equal(report.status,'unavailable');
 assert.equal(report.code,'SU2_DISCRETE_BOUNDARY_FLUX_UNAVAILABLE');assert.equal(report.units,null);
 assert.equal(report.nodalSurfaceMassflowIsDiscreteFlux,false);assert.equal(report.dimensionSpecificNormalizationVerified,false);assert.equal(report.physicalAcceptanceComplete,false);
 assert.ok(capabilities.unsupported.includes('solver-discrete-boundary-mass-flux'));
 assert.deepEqual(JSON.parse(JSON.stringify(report)),report);
 report.supported=true;assert.equal(su2DiscreteMassFluxCapability().supported,false);
});

test('discrete flux requests refuse rather than accepting nodal integrals or invented CSV',()=>{
 for(const candidate of [undefined,{Avg_Massflow:0},{in:-1,out:1},'marker,massflow\ninlet,-1\noutlet,1']){
  assert.throws(()=>requireSu2DiscreteMassFlux(candidate),error=>error.code==='SU2_DISCRETE_BOUNDARY_FLUX_UNAVAILABLE'&&error.capability.supported===false);
 }
});

test('numerical residual success and a balanced reported nodal diagnostic never establish physical mass acceptance',()=>{
 const result=assessSu2Run({'rms[P]':-10,'rms[U]':-10,'rms[V]':-10,Avg_Massflow:0},-6,'',{dimension:2,kind:'steady-incompressible-laminar'});
 assert.equal(result.numericallyConverged,true);assert.equal(result.physicalValidationComplete,false);
 assert.equal(su2DiscreteMassFluxCapability().physicalAcceptanceComplete,false);
 assert.throws(()=>requireSu2DiscreteMassFlux(result),{code:'SU2_DISCRETE_BOUNDARY_FLUX_UNAVAILABLE'});
});
