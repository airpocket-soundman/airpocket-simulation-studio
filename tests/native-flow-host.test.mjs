import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createNativeFlowHost} from '../scripts/native-flow-host.mjs';
test('native host authenticates exact origin and refuses changes to approved physics',async()=>{
 const root=await mkdtemp(join(tmpdir(),'native-flow-host-')),origin='http://127.0.0.1:5191';const input={schemaVersion:1,kind:'steady-incompressible-rans-sa',meshUnits:'m',densityKgM3:1.204,dynamicViscosityPaS:.0000181,velocityMps:[-5,0,0],wallMarker:'cow',farfieldMarker:'farfield',maxIterations:100,residualLog10Target:-5,turbulenceModel:'SA',wallTreatment:'standard-wall-function',turbulentViscosityRatio:10};
 const host=await createNativeFlowHost({origin,approvedInput:input,outputRoot:root,executable:join(root,'not-executed.exe'),meshPath:join(root,'not-read.su2')});
 try{
  assert.equal((await fetch(host.endpoint+'/capabilities',{headers:{Origin:origin}})).status,401);
  assert.equal((await fetch(host.endpoint+'/capabilities',{headers:{Origin:'http://evil.invalid',Authorization:`Bearer ${host.token}`}})).status,403);
  const headers={Origin:origin,Authorization:`Bearer ${host.token}`,'Content-Type':'application/json'};const capability=await(await fetch(host.endpoint+'/capabilities',{headers})).json();assert.deepEqual(capability.input,input);
  assert.equal(capability.discreteBoundaryMassFlux.supported,false);assert.equal(capability.discreteBoundaryMassFlux.code,'SU2_DISCRETE_BOUNDARY_FLUX_UNAVAILABLE');assert.equal(capability.discreteBoundaryMassFlux.nodalSurfaceMassflowIsDiscreteFlux,false);
  const response=await fetch(host.endpoint+'/jobs',{method:'POST',headers,body:JSON.stringify({requestId:'changed',input:{...input,velocityMps:[-50,0,0]}})});assert.equal(response.status,400);assert.equal(host.jobs.size,0);
 }finally{await host.close();await rm(root,{recursive:true,force:true});}
});
