import {test} from 'node:test';import assert from 'node:assert/strict';import initialize from '@loumalouomega/gmsh-wasm';import {generateMesh} from '../src/mesh-core.js';import {solveAcoustic} from '../src/acoustic-core.js';
test('Helmholtz pipe pressure agrees with sinusoidal reference',async()=>{const mesh=await generateMesh(initialize,{kind:'box',bounds:[0,0,0,10,10,40]},{size:4}),acousticPressures=[];for(let i=0;i<mesh.nodes.length/3;i++){const z=mesh.nodes[i*3+2];if(Math.abs(z)<1e-7)acousticPressures.push([i,1]);if(Math.abs(z-40)<1e-7)acousticPressures.push([i,0]);}const frequency=2000,c=343,k=2*Math.PI*frequency/c,result=solveAcoustic(mesh,{acousticPressures},{frequency,soundSpeed:c,lossFactor:0});for(let i=0;i<result.real.length;i++){const expected=Math.sin(k*(.04-mesh.nodes[i*3+2]*.001))/Math.sin(k*.04);assert.ok(Math.abs(result.real[i]-expected)<.006);assert.ok(Math.abs(result.imag[i])<1e-7);}assert.ok(Math.abs(result.spl[acousticPressures.find(x=>x[1]===1)[0]]-90.9691)<.001);});
import {readFileSync} from 'node:fs';
import {wasmMatvecFactory} from '../src/wasm-matvec.js';
import {acousticSweep} from '../src/acoustic-sweep.js';
test('acoustic frequency sweep and WASM backend agree with JS receiver results',async()=>{
const mesh=await generateMesh(initialize,{kind:'box',bounds:[0,0,0,10,10,40]},{size:5}),acousticPressures=[];
for(let i=0;i<mesh.nodes.length/3;i++){const z=mesh.nodes[i*3+2];if(Math.abs(z)<1e-7)acousticPressures.push([i,1]);if(Math.abs(z-40)<1e-7)acousticPressures.push([i,0]);}
const study={sweepStart:500,sweepEnd:3000,sweepCount:3,receiverPoint:[5,5,20],lossFactor:.01},boundary={acousticPressures},a=acousticSweep(mesh,boundary,study),{instance}=await WebAssembly.instantiate(readFileSync('public/fem-kernel.wasm')),b=acousticSweep(mesh,boundary,study,{matvecFactory:wasmMatvecFactory(instance)});
assert.equal(a.samples.length,3);for(let i=0;i<3;i++){assert.ok(Math.abs(a.samples[i].peakPressurePa-b.samples[i].peakPressurePa)<1e-7);assert.ok(a.samples[i].residual<1e-8);}assert.ok(a.samples[2].peakPressurePa>a.samples[0].peakPressurePa);assert.throws(()=>acousticSweep(mesh,boundary,{...study,sweepCount:0}),/Invalid/);
});
