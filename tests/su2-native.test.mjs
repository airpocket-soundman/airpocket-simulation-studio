import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSu2Config,parseSu2History,su2Capabilities,assessSu2Run} from '../scripts/su2-native.mjs';
const input={schemaVersion:1,kind:'steady-incompressible-laminar',meshUnits:'m',densityKgM3:998.2,dynamicViscosityPaS:.000798,velocityMps:[.000008,0,0],wallMarker:'cylinder',farfieldMarker:'farfield',maxIterations:500,residualLog10Target:-6};
test('native flow requires explicit units, physics and distinct mesh boundaries',()=>{
 for(const [key,value,code] of [['meshUnits','mm','SU2_MESH_UNITS'],['densityKgM3',undefined,'SU2_MATERIAL_REQUIRED'],['velocityMps',[0,0,0],'SU2_VELOCITY_REQUIRED'],['wallMarker','wall\nITER=1','SU2_BOUNDARY_REQUIRED'],['farfieldMarker','cylinder','SU2_BOUNDARY_CONFLICT'],['kind','turbulent','SU2_UNSUPPORTED_STUDY']])assert.throws(()=>buildSu2Config({...input,[key]:value}),e=>e.code===code);
 const config=buildSu2Config(input);assert.match(config,/SOLVER= INC_NAVIER_STOKES/);assert.match(config,/MU_CONSTANT= 0.000798/);assert.match(config,/INC_VELOCITY_INIT= \(0.000008, 0, 0\)/);
});
test('pressure stopping criterion never hides unconverged velocity or wall warnings',()=>{
 const result=assessSu2Run({'rms[P]':-6,'rms[U]':-3,'rms[nu]':-4},-5,'Warning: Computation of wall coefficients (y+) did not converge in 116 points.');assert.equal(result.pressureCriterionMet,true);assert.equal(result.numericallyConverged,false);assert.equal(result.allReportedResidualsMet,false);assert.equal(result.diagnostics[0].lastAffectedPoints,116);assert.ok(result.diagnostics[0].suggestions.length);
});
test('RANS requires explicit SA wall treatment and freestream setting',()=>{
 const rans={...input,kind:'steady-incompressible-rans-sa',turbulenceModel:'SA',wallTreatment:'standard-wall-function',turbulentViscosityRatio:10};assert.match(buildSu2Config(rans),/SOLVER= INC_RANS/);assert.match(buildSu2Config(rans),/INC_NONDIM= DIMENSIONAL/);assert.throws(()=>buildSu2Config({...rans,wallTreatment:undefined}),e=>e.code==='SU2_TURBULENCE_REQUIRED');
});
test('incomplete history cannot be interpreted as convergence',()=>{
 assert.equal(parseSu2History('"Inner_Iter","rms[P]"\n'),null);
 assert.equal(parseSu2History('"Inner_Iter","rms[P]"\n10,-'),null);
 assert.equal(parseSu2History('"Inner_Iter","rms[P]"\n10,'),null);
 assert.deepEqual(parseSu2History('"Inner_Iter","rms[P]"\n10,-6.2\n'),{Inner_Iter:10,'rms[P]':-6.2});
 assert.equal(su2Capabilities().browserWasm,false);assert.equal(su2Capabilities().physicalValidationComplete,false);
});

test('URANS uses physical time and all inner residuals with bounded outputs',()=>{
 const u={...input,kind:'unsteady-incompressible-rans-sa',turbulenceModel:'SA',wallTreatment:'standard-wall-function',freestreamNuFactor:10,maxIterations:40,timeStepSeconds:.01,timeSteps:20,outputEvery:2};
 const c=buildSu2Config(u);assert.match(c,/TIME_DOMAIN= YES/);assert.match(c,/TIME_MARCHING= DUAL_TIME_STEPPING-2ND_ORDER/);assert.match(c,/INNER_ITER= 40/);assert.match(c,/TIME_ITER= 20/);assert.doesNotMatch(c,/^ITER=/m);assert.match(c,/CONV_FIELD= \(RMS_PRESSURE, RMS_VELOCITY-X, RMS_VELOCITY-Y, RMS_VELOCITY-Z, RMS_NU_TILDE\)/);assert.match(c,/OUTPUT_WRT_FREQ= 2/);
 for(const patch of [{timeStepSeconds:0},{timeStepSeconds:NaN},{timeSteps:201},{outputEvery:0},{timeSteps:100,outputEvery:1},{maxIterations:501}])assert.throws(()=>buildSu2Config({...u,...patch}),e=>e.code==='SU2_TIME_SETTINGS');
});

test('wall Newton controls are explicit bounded numerical settings and cannot inject configuration',()=>{
 const r={...input,kind:'steady-incompressible-rans-sa',turbulenceModel:'SA',wallTreatment:'standard-wall-function',freestreamNuFactor:10,wallModelNumerics:{maximumIterations:1000,relaxationFactor:.2}};
 assert.match(buildSu2Config(r),/WALLMODEL_MAXITER= 1000/);assert.match(buildSu2Config(r),/WALLMODEL_RELFAC= 0.2/);
 for(const wallModelNumerics of [null,[],{maximumIterations:199,relaxationFactor:.2},{maximumIterations:2001,relaxationFactor:.2},{maximumIterations:1000,relaxationFactor:0},{maximumIterations:1000,relaxationFactor:.2,unknown:true}])assert.throws(()=>buildSu2Config({...r,wallModelNumerics}),e=>e.code==='SU2_WALL_NUMERICS');
 assert.throws(()=>buildSu2Config({...input,wallModelNumerics:r.wallModelNumerics}),e=>e.code==='SU2_WALL_NUMERICS');
});
