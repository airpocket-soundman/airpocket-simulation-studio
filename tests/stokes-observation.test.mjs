import {test} from 'node:test';import assert from 'node:assert/strict';
import {solveStokes} from '../src/stokes-core.js';import {solveStokesP2} from '../src/stokes-p2-core.js';
function fixture(){
 const nodes=[],tetrahedra=[],index=(x,y,z)=>x+3*y+9*z;for(let z=0;z<3;z++)for(let y=0;y<3;y++)for(let x=0;x<3;x++)nodes.push(x/2,y/2,z/2);
 const pattern=[[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]];
 for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){const ids=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]].map(([a,b,c])=>index(x+a,y+b,z+c));for(const t of pattern)tetrahedra.push(t.map(i=>ids[i]));}
 const faces=new Map();for(const t of tetrahedra)for(let k=0;k<4;k++){const face=t.filter((_,i)=>i!==k),key=face.slice().sort((a,b)=>a-b).join(',');if(faces.has(key))faces.delete(key);else faces.set(key,{nodes:face});}
 const surface=[...faces.values()].map(f=>({...f,faceTag:f.nodes.every(i=>nodes[3*i+1]===0)?1:2})),boundaryNodes=new Set(surface.flatMap(f=>f.nodes)),velocity=new Map([...boundaryNodes].map(i=>[i,[nodes[3*i+1]*.0001,0,0]]));
 return {mesh:{nodes,tetrahedra,surface},boundary:{velocity,bodyFaceTags:[1],pressureGauge:{node:0,valuePa:0}},properties:{dynamicViscosity:1,density:1000},options:{referenceLengthMm:1,referenceVelocity:[.0001,0,0],maxSeconds:30}};
}
test('P1 and P2 GMRES expose distinct estimated, checked preconditioned and final true residuals without changing numerics',()=>{
 for(const [solve,element]of [[solveStokes,'P1'],[solveStokesP2,'P2']]){const {mesh,boundary,properties,options}=fixture(),events=[],baseline=solve(mesh,properties,boundary,options),actual=solve(mesh,properties,boundary,{...options,onObserve:event=>events.push(event)});assert.deepEqual(actual,baseline);assert.ok(events.some(e=>e.phase==='arnoldi-estimate'));assert.ok(events.some(e=>e.phase==='restart-check'));assert.equal(events.at(-1).phase,'final-check');assert.equal(events.at(-1).residual,actual.residual);assert.equal(events.at(-1).iteration,actual.iterations);
 for(const event of events){assert.equal(event.stage,'iteration');assert.equal(event.solver,'stokes-gmres');assert.equal(event.velocityElement,element);assert.ok(Number.isFinite(event.residual)&&event.residual>=0);assert.ok(Number.isInteger(event.iteration)&&event.iteration>=0);assert.equal(event.field,undefined);assert.equal(event.time,undefined);assert.equal(event.residualKind,{'arnoldi-estimate':'preconditioned-relative-estimate','restart-check':'preconditioned-relative','final-check':'true-relative'}[event.phase]);assert.equal(event.converged,event.residual<event.tolerance||event.phase==='final-check');}
 const original=events[1].residual;events[0].residual=99;assert.equal(events[1].residual,original);
 }
});
test('zero RHS skips Arnoldi but reports the existing final true residual and observer is strictly optional',()=>{
 for(const solve of [solveStokes,solveStokesP2]){const {mesh,boundary,properties,options}=fixture();for(const node of boundary.velocity.keys())boundary.velocity.set(node,[0,0,0]);const events=[],result=solve(mesh,properties,boundary,{...options,onObserve:e=>events.push(e)});assert.equal(result.iterations,0);assert.deepEqual(events.map(e=>e.phase),['final-check']);assert.equal(events[0].iteration,0);assert.equal(events[0].residual,0);for(const onObserve of [null,0,true,'observer'])assert.throws(()=>solve(mesh,properties,boundary,{...options,onObserve}),/onObserve/);}
});
test('observer exceptions propagate and exhausted budgets never emit a final accepted check',()=>{
 for(const solve of [solveStokes,solveStokesP2]){const {mesh,boundary,properties,options}=fixture();assert.throws(()=>solve(mesh,properties,boundary,{...options,onObserve:()=>{throw Error('Observer failed');}}),/Observer failed/);const events=[];assert.throws(()=>solve(mesh,properties,boundary,{...options,maxIterations:1,onObserve:e=>events.push(e)}),/iteration limit/);assert.ok(!events.some(e=>e.phase==='final-check'));assert.ok(events.some(e=>e.phase==='arnoldi-estimate'&&e.iteration===1));let tick=0;const timed=[];assert.throws(()=>solve(mesh,properties,boundary,{...options,maxSeconds:.001,now:()=>++tick*1000,onObserve:e=>timed.push(e)}),/time budget/);assert.equal(timed.length,0);}
});
