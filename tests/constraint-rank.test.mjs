import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BoxGeometry} from 'three';
import {analyzeRigidBodyConstraints,rigidConstraintRank,RANK_RELATIVE_TOLERANCE} from '../src/constraint-rank.js';
import {getProjectRevision} from '../src/project-revision.js';
import {callStudioTool} from '../scripts/studio-mcp.mjs';

// Unit cube, nodes 0..7 (x=bit0, y=bit1, z=bit2); the tetrahedra only need to connect all eight nodes.
const cube={nodes:[0,0,0, 1,0,0, 0,1,0, 1,1,0, 0,0,1, 1,0,1, 0,1,1, 1,1,1],tetrahedra:[[0,1,2,4],[3,1,2,7],[5,1,4,7],[6,2,4,7],[1,2,4,7]]};
const run=(boundary,project={study:{kind:'structural'}},mesh=cube)=>analyzeRigidBodyConstraints({project,mesh,boundary});
const status=(r)=>Object.fromEntries(r.modes.map(m=>[m.mode,m.status]));

test('fully fixed face eliminates all six rigid-body modes',()=>{
 const r=run({fixed:[0,1,2,3],displacements:[]});
 assert.equal(r.status,'checked');assert.equal(r.rigidBodyModesEliminated,true);assert.equal(r.freeRigidModeCount,0);assert.deepEqual(r.diagnostics,[]);
 assert.ok(r.modes.every(m=>m.status==='eliminated'));assert.equal(r.components[0].rank,6);
});

test('a single fixed node leaves the three rotations free',()=>{
 const r=run({fixed:[0],displacements:[]});
 assert.equal(r.rigidBodyModesEliminated,false);assert.equal(r.freeRigidModeCount,3);
 assert.deepEqual(status(r),{'translation-x':'eliminated','translation-y':'eliminated','translation-z':'eliminated','rotation-x':'free','rotation-y':'free','rotation-z':'free'});
 assert.equal(r.diagnostics[0].code,'ANALYSIS_RIGID_BODY_MODE_FREE');assert.equal(r.diagnostics[0].severity,'error');
 assert.match(r.modes[5].description,/rotation about the z axis is not constrained/);
});

test('three non-collinear fixed nodes eliminate all rigid-body modes',()=>{
 const r=run({fixed:[0,1,2],displacements:[]});
 assert.equal(r.rigidBodyModesEliminated,true);assert.equal(r.freeRigidModeCount,0);assert.deepEqual(r.diagnostics,[]);
});

test('two fixed nodes leave rotation about their common axis free (and nothing else)',()=>{
 const r=run({fixed:[0,1],displacements:[]}); // nodes 0 and 1 lie on the x axis
 assert.equal(r.freeRigidModeCount,1);assert.equal(r.rigidBodyModesEliminated,false);
 assert.deepEqual(status(r),{'translation-x':'eliminated','translation-y':'eliminated','translation-z':'eliminated','rotation-x':'free','rotation-y':'eliminated','rotation-z':'eliminated'});
 assert.match(r.diagnostics[0].message,/rotation about the x axis is not constrained/);
 const z=run({fixed:[0,4],displacements:[]});assert.equal(z.freeRigidModeCount,1);assert.equal(status(z)['rotation-z'],'free');
 const mid={nodes:[...cube.nodes,.5,0,0],tetrahedra:[...cube.tetrahedra,[8,1,2,4]]};
 assert.equal(run({fixed:[0,1,8],displacements:[]},undefined,mid).freeRigidModeCount,1);
});

test('roller-only supports leave translations and rotations free',()=>{
 const r=run({fixed:[],displacements:[0,1,2,3].map(node=>({node,direction:[0,0,1],valueMm:0}))});
 assert.equal(r.rigidBodyModesEliminated,false);assert.equal(r.freeRigidModeCount,3);
 assert.equal(status(r)['translation-x'],'free');assert.equal(status(r)['translation-y'],'free');assert.equal(status(r)['rotation-z'],'free');
 assert.equal(status(r)['translation-z'],'eliminated');
 assert.equal(run({fixed:[],displacements:[0,1,2,3].map(node=>({node,direction:[0,0,1],valueMm:2}))}).freeRigidModeCount,3);
 const six=[{node:0,direction:[1,0,0]},{node:0,direction:[0,1,0]},{node:0,direction:[0,0,1]},{node:1,direction:[0,1,0]},{node:1,direction:[0,0,1]},{node:2,direction:[0,0,1]}].map(d=>({...d,valueMm:0}));
 assert.equal(run({fixed:[],displacements:six}).rigidBodyModesEliminated,true);
 assert.equal(run({fixed:[],displacements:[]}).freeRigidModeCount,6);
});

test('numerical tolerance: nearly collinear fixed nodes are reported free, a clearly non-collinear triple is eliminated',()=>{
 const tri=(offset)=>({nodes:[0,0,0, 1,0,0, .5,offset,0, 0,0,1],tetrahedra:[[0,1,2,3]]});
 assert.equal(RANK_RELATIVE_TOLERANCE,1e-6);
 assert.equal(run({fixed:[0,1,2],displacements:[]},undefined,tri(1e-9)).rigidBodyModesEliminated,false);
 assert.equal(run({fixed:[0,1,2],displacements:[]},undefined,tri(1e-2)).rigidBodyModesEliminated,true);
 assert.equal(run({fixed:[0,1,2],displacements:[]},undefined,tri(0)).freeRigidModeCount,1);
 const scaled=(k)=>({nodes:tri(1e-2).nodes.map(v=>v*k),tetrahedra:[[0,1,2,3]]});
 for(const k of [1e-3,1e3])assert.equal(run({fixed:[0,1,2],displacements:[]},undefined,scaled(k)).rigidBodyModesEliminated,true);
 assert.equal(rigidConstraintRank([[1,0,0,0,0,0],[0,1,0,0,0,0],[1,1,0,0,0,0]]).rank,2);
});

test('disconnected solids are checked independently; other physics is not applicable; unusable meshes are unknown',()=>{
 const two={nodes:[0,0,0, 1,0,0, 0,1,0, 0,0,1, 5,0,0, 6,0,0, 5,1,0, 5,0,1],tetrahedra:[[0,1,2,3],[4,5,6,7]]};
 const r=run({fixed:[0,1,2],displacements:[]},undefined,two);
 assert.equal(r.components.length,2);assert.equal(r.rigidBodyModesEliminated,false);assert.equal(r.freeRigidModeCount,6);assert.equal(r.components[0].rank,6);assert.equal(r.components[1].rank,0);
 const thermal=run({fixed:[],displacements:[]},{study:{kind:'thermal'}});assert.equal(thermal.status,'not-applicable');assert.equal(thermal.rigidBodyModesEliminated,false);assert.ok(thermal.modes.every(m=>m.status==='not-applicable'));assert.deepEqual(thermal.diagnostics,[]);
 assert.equal(run({fixed:[],displacements:[]},{study:{modalAnalysis:true}}).status,'not-applicable');
 const empty=run({fixed:[0],displacements:[]},undefined,{nodes:[0,0,0],surface:[]});assert.equal(empty.status,'unknown');assert.equal(empty.rigidBodyModesEliminated,false);assert.ok(empty.modes.every(m=>m.status==='unknown'));
 const bad=run({fixed:[99],displacements:[]});assert.equal(bad.status,'unknown');assert.equal(bad.rigidBodyModesEliminated,false);
});

function barProject(condition){
 const geometry=new BoxGeometry(10,10,40).toNonIndexed();geometry.translate(5,5,20);const positions=Array.from(geometry.attributes.position.array);geometry.dispose();
 const bottom=Array.from({length:12},(_,index)=>index).filter(index=>[2,5,8].every(axis=>positions[index*9+axis]===0));
 return {version:1,sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind:'structural',gravityEnabled:false},materialProperties:{youngModulus:1e9,poissonRatio:.25},meshes:[{positions,faceIds:Array.from({length:12},(_,index)=>Math.floor(index/2))}],selection:[[]],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:bottom}],...condition}]};
}
async function settled(jobId){const end=Date.now()+30000;while(Date.now()<end){const job=await callStudioTool('studio_job_status',{jobId});if(job.executionSettled)return job;await new Promise(r=>setTimeout(r,20));}throw Error('mesh job did not settle');}

test('axial-bar reference demo through the MCP preflight: fixed bottom face eliminates the modes; a roller-only face does not and stays non-blocking',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'studio-rigid-'));
 try{
  for(const [name,condition,expected] of [['fixed',{},true],['roller',{type:'displacement',value:0,direction:[0,0,1]},false]]){
   const input=barProject(condition),inputPath=join(directory,name+'.json'),outputPath=join(directory,name+'-mesh.json');await writeFile(inputPath,JSON.stringify(input));
   const revision=await getProjectRevision(input),started=await callStudioTool('studio_start_analysis',{path:inputPath,outputPath,requestId:'rigid-'+name,operation:'mesh',size:5,method:'wasm-pcg'}),job=await settled(started.jobId);assert.equal(job.state,'succeeded',JSON.stringify(job.error));
   const result=await callStudioTool('studio_preflight_mesh_boundaries',{path:inputPath,jobId:job.jobId,inputRevision:revision});
   assert.equal(result.allowed,true,JSON.stringify(result.diagnostics));assert.equal(result.completePreflight,false);assert.equal(result.rigidBody.status,'checked');assert.equal(result.rigidBody.rigidBodyModesEliminated,expected);
   assert.doesNotMatch(result.remainingChecks.join(' '),/Constraint rank and rigid-body modes have not been checked/);assert.match(result.remainingChecks.join(' '),/convergence and physical accuracy/);
   if(expected){assert.equal(result.rigidBody.freeRigidModeCount,0);assert.deepEqual(result.diagnostics,[]);}
   else{assert.equal(result.rigidBody.freeRigidModeCount,3);assert.equal(result.diagnostics[0].code,'ANALYSIS_RIGID_BODY_MODE_FREE');assert.equal(result.diagnostics[0].severity,'error');assert.equal(result.reports.length,1);}
  }
 }finally{await rm(directory,{recursive:true,force:true});}
});
