import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSu2Config,parseSu2History,su2Capabilities} from '../scripts/su2-native.mjs';
const input={schemaVersion:1,kind:'steady-incompressible-laminar',meshUnits:'m',densityKgM3:998.2,dynamicViscosityPaS:.000798,velocityMps:[.000008,0,0],wallMarker:'cylinder',farfieldMarker:'farfield',maxIterations:500,residualLog10Target:-6};
test('native flow requires explicit units, physics and distinct mesh boundaries',()=>{
 for(const [key,value,code] of [['meshUnits','mm','SU2_MESH_UNITS'],['densityKgM3',undefined,'SU2_MATERIAL_REQUIRED'],['velocityMps',[0,0,0],'SU2_VELOCITY_REQUIRED'],['wallMarker','wall\nITER=1','SU2_BOUNDARY_REQUIRED'],['farfieldMarker','cylinder','SU2_BOUNDARY_CONFLICT'],['kind','turbulent','SU2_UNSUPPORTED_STUDY']])assert.throws(()=>buildSu2Config({...input,[key]:value}),e=>e.code===code);
 const config=buildSu2Config(input);assert.match(config,/SOLVER= INC_NAVIER_STOKES/);assert.match(config,/MU_CONSTANT= 0.000798/);assert.match(config,/INC_VELOCITY_INIT= \(0.000008, 0, 0\)/);
});
test('incomplete history cannot be interpreted as convergence',()=>{
 assert.equal(parseSu2History('"Inner_Iter","rms[P]"\n'),null);
 assert.equal(parseSu2History('"Inner_Iter","rms[P]"\n10,-'),null);
 assert.equal(parseSu2History('"Inner_Iter","rms[P]"\n10,'),null);
 assert.deepEqual(parseSu2History('"Inner_Iter","rms[P]"\n10,-6.2\n'),{Inner_Iter:10,'rms[P]':-6.2});
 assert.equal(su2Capabilities().browserWasm,false);assert.equal(su2Capabilities().physicalValidationComplete,false);
});
