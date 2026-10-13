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
test('pressure-driven cavity and pipe exhibit reference resonances with finite damping',async()=>{
 let instance;const init=opts=>instance??=initialize(opts);
 for(const {bounds,size,frequency,off,closed,expected,tolerance}of [{bounds:[0,0,0,20,20,40],size:5,frequency:2143.75,off:[1500,2800],closed:true,expected:63.663,tolerance:.025},{bounds:[0,0,0,10,10,40],size:4,frequency:4287.5,off:[3500,5000],closed:false,expected:31.837,tolerance:.06}]){
 const mesh=await generateMesh(init,{kind:'box',bounds},{size}),p=[];assert.equal(mesh.summary.qualityHistogram.reduce((s,v)=>s+v,0),mesh.tetrahedra.length);
 for(let i=0;i<mesh.nodes.length/3;i++){const z=mesh.nodes[i*3+2];if(Math.abs(z)<1e-7)p.push([i,1]);if(!closed&&Math.abs(z-40)<1e-7)p.push([i,0]);}
 const solve=f=>solveAcoustic(mesh,{acousticPressures:p},{frequency:f,lossFactor:.02}),peak=solve(frequency);assert.ok(Math.abs(peak.maxPressurePa/expected-1)<tolerance);for(const f of off)assert.ok(peak.maxPressurePa>10*solve(f).maxPressurePa);assert.ok(peak.residual<1e-8);
 }
});
