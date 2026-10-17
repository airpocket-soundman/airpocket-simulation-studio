import {test} from 'node:test';
import assert from 'node:assert/strict';
import initialize from '@loumalouomega/gmsh-wasm';
import {analyzeMeshValidity} from '../src/mesh-validity.js';
import {inspectMesh,generateMesh,tetraVolume} from '../src/mesh-core.js';
import {elementGeometry,solveElastic} from '../src/fem-core.js';
import {solveThermal} from '../src/thermal-core.js';
import {solveAcoustic} from '../src/acoustic-core.js';
import {preflightMeshBoundaryTransfer} from '../src/mesh-boundary-preflight.js';
import {getProjectRevision} from '../src/project-revision.js';
const tetra=()=>({nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[],qualities:[.5]});
const project=kind=>({version:1,sourceModel:{kind:'box',bounds:[0,0,0,1,1,1]},meshes:[],conditions:[],study:{kind,frequency:1000,soundSpeed:343,lossFactor:0,transient:true}});
async function inspect(input,mesh){const revision=await getProjectRevision(input);return preflightMeshBoundaryTransfer({project:input,job:{jobId:'m',inputRevision:revision,state:'succeeded',executionSettled:true,operation:'mesh'},output:{input,mesh},expectedRevision:revision});}

test('Tet4 numerical geometry and real solver values remain unchanged; negative orientation read-only then normalized by inspectMesh',()=>{
 const mesh=tetra(),g=elementGeometry(mesh,mesh.tetrahedra[0]);assert.equal(g.volume,1/6*1e-9);assert.deepEqual(g.grad,[[-1000,-1000,-1000],[1000,0,0],[0,1000,0],[0,0,1000]]);
 const before=JSON.stringify(mesh),check=analyzeMeshValidity(mesh);assert.equal(check.allowed,true);assert.equal(check.report.volumeMm3,1/6);assert.equal(check.report.minQuality,.5);assert.equal(JSON.stringify(mesh),before);
 const negative=tetra();negative.tetrahedra[0]=[1,0,2,3];const saved=JSON.stringify(negative);assert.equal(analyzeMeshValidity(negative).report.negativeOrientationCount,1);assert.equal(JSON.stringify(negative),saved);assert.equal(tetraVolume(negative.nodes,negative.tetrahedra[0])<0,true);inspectMesh(negative);assert.equal(tetraVolume(negative.nodes,negative.tetrahedra[0])>0,true);
 const elastic=solveElastic(mesh,{youngModulus:1e9,poissonRatio:.25},{fixed:[0,1,2,3],forces:[{node:3,value:[0,0,-1]}]});assert.deepEqual(elastic.reaction,[0,0,1]);assert.ok(elastic.displacement.every(v=>v===0));
 const thermal=solveThermal(mesh,{conductivity:2},{temperatures:[[0,20],[1,20],[2,20],[3,20]]});assert.ok(thermal.temperature.every(v=>v===20));assert.ok(Math.abs(thermal.energyBalanceErrorW)<1e-15);
 const acoustic=solveAcoustic(mesh,{acousticPressures:[[0,1],[1,1],[2,1],[3,1]]},{frequency:1000,soundSpeed:343,lossFactor:0});assert.deepEqual(acoustic.real,[1,1,1,1]);assert.ok(acoustic.imag.every(v=>v===0));
});

test('existing volume threshold and solver pivot threshold are retained without a quality cutoff',()=>{
 const at=tetra();at.nodes[3]=6.000000000000001e-15;assert.equal(analyzeMeshValidity(at).allowed,true);at.nodes[3]*=.999;assert.equal(analyzeMeshValidity(at).diagnostics[0].code,'ANALYSIS_MESH_ELEMENT_DEGENERATE');
 const tinyAxis=tetra();tinyAxis.nodes[3]=1e-18;tinyAxis.nodes[7]=1e10;tinyAxis.nodes[11]=1e10;assert.throws(()=>elementGeometry(tinyAxis,tinyAxis.tetrahedra[0]),/Singular element/);assert.equal(analyzeMeshValidity(tinyAxis).diagnostics[0].code,'ANALYSIS_MESH_ELEMENT_SINGULAR');
 const q=tetra();q.qualities=null;assert.equal(analyzeMeshValidity(q).allowed,true);assert.equal(analyzeMeshValidity(q).report.qualityAvailable,false);q.qualities=[-1];assert.equal(analyzeMeshValidity(q).allowed,true);q.qualities=[100];assert.equal(analyzeMeshValidity(q).allowed,true);
});

test('invalid connectivity, nodes, finite-overflow, quality data and diagnostics are bounded and JSON safe',()=>{
 for(const edit of [m=>m.tetrahedra[0]=[0,0,2,3],m=>m.tetrahedra[0]=[0,1,2,9],m=>m.tetrahedra[0]=[0,1,2,.5],m=>delete m.tetrahedra[0][3],m=>m.nodes[11]=0,m=>m.nodes[0]=NaN,m=>m.nodes[3]=Infinity,m=>m.nodes=m.nodes.map(v=>v*1e200),m=>m.qualities=[],m=>m.qualities=[Infinity]]){const m=tetra();edit(m);const result=analyzeMeshValidity(m);assert.equal(result.allowed,false);assert.ok(result.diagnostics.length);assert.doesNotThrow(()=>JSON.stringify(result));}
 const many=tetra();many.tetrahedra=Array.from({length:60},()=>[0,0,2,3]);delete many.qualities;const result=analyzeMeshValidity(many);assert.equal(result.diagnostics.length,20);assert.equal(result.report.diagnosticCount,60);assert.equal(result.report.diagnosticsTruncated,true);assert.equal(result.diagnostics[0].target,'/job/mesh/tetrahedra/0');
});

test('read-only postmesh API gates all supported physics before boundary transfer and identifies nonfinite coordinates',async()=>{
 for(const kind of ['structural','thermal','acoustic']){const input=project(kind),mesh=tetra(),before=JSON.stringify({input,mesh});const normal=await inspect(input,mesh);assert.equal(normal.meshQuality.elementCount,1);assert.equal(normal.meshQuality.volumeMm3,1/6);assert.equal(JSON.stringify({input,mesh}),before);
  mesh.tetrahedra[0]=[0,0,2,3];const failed=await inspect(input,mesh);assert.equal(failed.allowed,false);assert.equal(failed.diagnostics[0].code,'ANALYSIS_MESH_ELEMENT_CONNECTIVITY_INVALID');assert.equal(failed.diagnostics[0].stage,'mesh');assert.equal(failed.meshQuality.diagnosticCount,1);assert.deepEqual(failed.reports,[]);
  const nonfinite=tetra();nonfinite.nodes[5]=NaN;const refused=await inspect(input,nonfinite);assert.equal(refused.allowed,false);assert.equal(refused.diagnostics[0].code,'ANALYSIS_MESH_NODE_NONFINITE');assert.equal(refused.diagnostics[0].target,'/job/mesh/nodes/5');assert.equal(refused.diagnostics[0].evidence.nodeIndex,1);
 }
});

test('actual Gmsh quality/volume matches historical summary without mutation or a new quality threshold',async()=>{
 const mesh=await generateMesh(initialize,{kind:'box',bounds:[0,0,0,10,10,10]},{size:5}),before=JSON.stringify(mesh),result=analyzeMeshValidity(mesh);assert.equal(result.allowed,true);assert.ok(Math.abs(result.report.volumeMm3-1000)<1e-8);assert.deepEqual(result.report.qualityHistogram,mesh.summary.qualityHistogram);assert.equal(result.report.minQuality,mesh.summary.minQuality);assert.equal(result.report.nodeCount,mesh.summary.nodeCount);assert.equal(JSON.stringify(mesh),before);assert.ok(mesh.tetrahedra.every(t=>elementGeometry(mesh,t).grad.flat().every(Number.isFinite)));
});

test('inspectMesh retains legacy malformed-mesh messages separately from structured postmesh diagnostics',()=>{
 assert.throws(()=>inspectMesh({nodes:[0,0,0],tetrahedra:[[0,0,0,0]]}),/^Error: Invalid tetrahedron$/);
 assert.throws(()=>inspectMesh({nodes:[0,0],tetrahedra:[[0,0,0,0]]}),/^Error: Invalid volume mesh$/);
 const mesh=tetra();mesh.tetrahedra[0]=[0,0,2,3];assert.throws(()=>inspectMesh(mesh),/^Error: Invalid tetrahedron$/);assert.equal(analyzeMeshValidity(mesh).diagnostics[0].code,'ANALYSIS_MESH_ELEMENT_CONNECTIVITY_INVALID');
});
