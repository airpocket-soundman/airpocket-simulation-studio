import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveAcoustic} from '../src/acoustic-core.js';
import {solveAcousticTransient} from '../src/acoustic-transient.js';
import {solveThermal} from '../src/thermal-core.js';
import {thermalContactEntries} from '../src/thermal-contact.js';
import {analyzeAcousticResolution,analyzeComponentAnchoring} from '../src/mesh-resolution-preflight.js';
import {acousticResolutionLimits,acousticEdgeResolved} from '../src/acoustic-resolution-contract.js';
const tetra=h=>({nodes:[0,0,0,h,0,0,0,h,0,0,0,h],tetrahedra:[[0,1,2,3]],surface:[]});
const source={acousticPressures:[[0,1],[1,1],[2,1],[3,1]]};

test('harmonic preflight and real solver agree at both sides of existing damped wavelength and target-size limits',()=>{
 for(const lossFactor of [0,.01,2]){const study={kind:'acoustic',frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor},limit=acousticResolutionLimits(study);assert.equal(acousticEdgeResolved(limit.maxEdgeMm,limit),true);assert.equal(acousticEdgeResolved(limit.maxEdgeMm*(1+1e-10),limit),false);
  for(const factor of [.999,1.001]){const mesh=tetra(limit.maxEdgeMm/Math.SQRT2*factor),check=analyzeAcousticResolution({project:{study},mesh});if(factor<1){assert.equal(check.report.level,'ok');const result=solveAcoustic(mesh,source,study);assert.ok(result.real.every(Number.isFinite));}else{assert.equal(check.report.level,'refuse');assert.throws(()=>solveAcoustic(mesh,source,study),/one sixth wavelength/);}}
  const mesh=tetra(1);mesh.size=limit.maxTargetSizeMm*1.001;const check=analyzeAcousticResolution({project:{study},mesh});assert.equal(check.report.reason,'solver-target-size-limit');assert.equal(check.diagnostics[0].code,'ACOUSTIC_MESH_WAVELENGTH_UNRESOLVED');assert.throws(()=>solveAcoustic(mesh,source,study),/target size/);
 }
});

test('transient preflight uses real pulse bandwidth rather than carrier alone and matches actual solver',()=>{
 const study={kind:'acoustic',acousticTransient:true,frequency:100,soundSpeed:343,airDensity:1.2,lossFactor:0,pulseWidth:.0001,acousticDuration:.0012,acousticTimeStep:0,dampingRate:0,receiverPoint:[.1,.1,.1]},limit=acousticResolutionLimits({...study,transient:true});
 for(const factor of [.999,1.001]){const mesh=tetra(limit.maxEdgeMm/Math.SQRT2*factor),check=analyzeAcousticResolution({project:{study},mesh});assert.equal(check.report.highestFrequencyOf,'three-sigma-pulse-bandwidth');assert.equal(check.report.bandwidthHz,study.frequency+3/(2*Math.PI*study.pulseWidth));
  assert.equal(analyzeAcousticResolution({project:{study:{...study,acousticTransient:false}},mesh}).report.level,'ok');
  if(factor<1){assert.equal(check.report.level,'ok');const result=solveAcousticTransient(mesh,source,study);assert.ok(result.pressure.every(Number.isFinite));assert.equal(result.bandwidthHz,check.report.bandwidthHz);}else{assert.equal(check.report.level,'refuse');assert.throws(()=>solveAcousticTransient(mesh,source,study),/three-sigma/);}
 }
});

test('real transferred contact rescues only connected anchored solids; isolated third solid remains refused by solver',()=>{
 const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,-1],tetrahedra:[[0,1,2,3],[4,5,6,7]],surface:[]},contacts=thermalContactEntries(mesh,[{nodes:[0,1,2]}],[{nodes:[4,5,6]}],1000),project={study:{kind:'thermal',transient:false}},boundary={temperatures:[[3,20]],contacts},material={conductivity:2};
 const initial=JSON.stringify({mesh,boundary});const coupled=analyzeComponentAnchoring({project,mesh,boundary});assert.equal(coupled.report.componentCount,1);assert.equal(coupled.report.unanchoredComponentCount,0);assert.deepEqual(coupled.diagnostics,[]);assert.ok(solveThermal(mesh,material,boundary).temperature.every(t=>Math.abs(t-20)<1e-6));assert.equal(JSON.stringify({mesh,boundary}),initial);
 const isolated=structuredClone(mesh);isolated.nodes.push(10,0,0,11,0,0,10,1,0,10,0,1);isolated.tetrahedra.push([8,9,10,11]);const failed=analyzeComponentAnchoring({project,mesh:isolated,boundary});assert.equal(failed.report.componentCount,2);assert.equal(failed.report.unanchoredComponentCount,1);assert.equal(failed.diagnostics[0].severity,'error');assert.throws(()=>solveThermal(isolated,material,boundary),/Each disconnected solid/);
 const repaired={...boundary,temperatures:[...boundary.temperatures,[8,20]]};assert.equal(analyzeComponentAnchoring({project,mesh:isolated,boundary:repaired}).diagnostics.length,0);assert.ok(solveThermal(isolated,material,repaired).temperature.every(Number.isFinite));
 const transient=solveThermal(isolated,{...material,density:1000,specificHeat:1000},{contacts},{transient:true,timeStep:1,steps:1,initialTemperature:20});assert.ok(transient.temperature.every(Number.isFinite));assert.equal(analyzeComponentAnchoring({project:{study:{kind:'thermal',transient:true}},mesh:isolated,boundary:{contacts}}).report.status,'not-applicable');
});
