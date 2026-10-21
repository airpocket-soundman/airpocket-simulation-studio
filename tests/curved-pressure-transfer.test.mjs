import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateCurvedPressure,pressureNodalForces,faceNormalDisplacementIntegral,virtualWorkIdentity} from '../src/curved-pressure-transfer.js';

const triangle={lengthUnit:'mm',pressureUnit:'Pa',surface:'open',nodes:[0,0,0,10,0,0,0,10,0],triangles:[[0,1,2]],pressure:[{real:1000,imag:500}]};
// Closed octahedron on +/-10 mm axes. A faceted polyhedron, NOT a smooth-sphere accuracy reference.
const octaNodes=[10,0,0,-10,0,0,0,10,0,0,-10,0,0,0,10,0,0,-10];
const octaTriangles=[[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
const octa={lengthUnit:'mm',pressureUnit:'Pa',surface:'closed',nodes:octaNodes,triangles:octaTriangles,pressure:Array.from({length:8},()=>({real:1000,imag:500}))};
const translation={real:Array.from({length:18},(_,i)=>i%3===0?1e-3:0),imag:Array(18).fill(0)};

test('right triangle (0,0,0),(10,0,0),(0,10,0) mm gives area 50 mm^2, +Z normal and the reference complex force',()=>{
 const r=pressureNodalForces(triangle);
 assert.equal(r.areasMm2[0],50);assert.deepEqual(r.normals[0],[0,0,1]);assert.equal(r.metadata.transfer,'facet-fixed complex pressure / equal area-3 nodal distribution');
 assert.ok(Math.abs(r.resultantReal[2]-(-0.05))<1e-15);assert.ok(Math.abs(r.resultantImag[2]-(-0.025))<1e-15);
 assert.ok(Math.abs(r.resultantReal[0])<1e-15&&Math.abs(r.resultantImag[0])<1e-15&&Math.abs(r.resultantReal[1])<1e-15&&Math.abs(r.resultantImag[1])<1e-15);
 for(let i=0;i<3;i++){assert.ok(Math.abs(r.forceReal[3*i+2]-(-1/60))<1e-15);assert.ok(Math.abs(r.forceImag[3*i+2]-(-1/120))<1e-15);}
 assert.ok(r.forceImag.some(v=>Math.abs(v)>1e-6));
});

test('reversing the open-face winding inverts the geometry normal and the load sign',()=>{
 const r=pressureNodalForces({...triangle,triangles:[[0,2,1]]});
 assert.deepEqual(r.normals[0],[0,0,-1]);assert.ok(Math.abs(r.resultantReal[2]-0.05)<1e-15);assert.ok(Math.abs(r.resultantImag[2]-0.025)<1e-15);
});

test('equal pressure magnitude with different phase gives different complex force (imaginary phase is not discarded)',()=>{
 const magnitude=Math.hypot(1000,500),phase0=pressureNodalForces({...triangle,pressure:[{real:magnitude,imag:0}]}),phase90=pressureNodalForces({...triangle,pressure:[{real:0,imag:magnitude}]});
 assert.ok(Math.abs(phase0.forceImag[2])<1e-18&&Math.abs(phase0.forceReal[2])>1e-3);
 assert.ok(Math.abs(phase90.forceReal[2])<1e-18&&Math.abs(phase90.forceImag[2])>1e-3);
});

test('facets 8*50*sqrt(3) mm^2 cover the closed octahedron and a uniform pressure gives ~zero force and moment',()=>{
 const r=pressureNodalForces(octa);
 assert.equal(r.metadata.faceCount,8);assert.ok(Math.abs(r.totalAreaMm2-400*Math.sqrt(3))<1e-9);
 assert.ok(Math.max(...r.resultantReal.map(Math.abs),...r.resultantImag.map(Math.abs))<1e-12);
 assert.ok(Math.max(...r.momentReal.map(Math.abs),...r.momentImag.map(Math.abs))<1e-12);
});

test('conservative duality: Sigma conj(u).f equals -Sigma p*conj(integral u.n dA) for per-face complex pressure with relative error <= 1e-12',()=>{
 const pressure=[[1000,500],[1200,100],[800,-50],[900,200],[1100,50],[700,-100],[1300,150],[950,0]].map(([real,imag])=>({real,imag})),load={...octa,pressure};
 const displacement={real:Array.from({length:18},(_,i)=>((i*7)%11-5)*2e-4),imag:Array.from({length:18},(_,i)=>((i*5)%7-3)*3e-4)};
 const w=virtualWorkIdentity(load,displacement);
 assert.ok(w.relativeErrorJ<=1e-12);assert.ok(w.absoluteErrorJ<=1e-14);
 assert.ok(Math.hypot(w.pressureWork.real,w.pressureWork.imag)>1e-6);
});

test('uniform pressure on the closed octahedron does zero work for rigid translation and rigid rotation',()=>{
 const rot={real:Array.from({length:18},(_,i)=>{const n=Math.floor(i/3),c=['x','y','z'][i%3],r=octaNodes.slice(3*n,3*n+3).map(v=>v*1e-3);return c==='x'?-r[1]:c==='y'?r[0]:0;}),imag:Array(18).fill(0)};
 const wt=virtualWorkIdentity(octa,translation),wr=virtualWorkIdentity(octa,rot),vol=faceNormalDisplacementIntegral(octa,translation);
 assert.ok(wt.absoluteErrorJ<=1e-14&&Math.hypot(wt.pressureWork.real,wt.pressureWork.imag)<=1e-14);
 assert.ok(wr.absoluteErrorJ<=1e-14&&Math.hypot(wr.pressureWork.real,wr.pressureWork.imag)<=1e-14);
 assert.ok(Math.hypot(vol.totalVolumeReal,vol.totalVolumeImag)<=1e-15);
 assert.equal(vol.unit,'m^3');
});

test('per-face different pressure gives a generally nonzero force/moment and a nonzero rigid-translation work (no zero-work requirement)',()=>{
 // A closed tetrahedron is used here because every octahedron face centroid lies along its own
 // normal (c x n = 0), so its origin moment is structurally zero for any pressure.
 const nodes=[0,0,0,10,0,0,0,10,0,0,0,10],triangles=[[0,2,1],[0,1,3],[0,3,2],[1,2,3]];
 const load={lengthUnit:'mm',pressureUnit:'Pa',surface:'closed',nodes,triangles,pressure:[[1200,100],[800,-50],[900,250],[2000,0]].map(([real,imag])=>({real,imag}))};
 const translation12={real:Array.from({length:12},(_,i)=>i%3===0?1e-3:0),imag:Array(12).fill(0)};
 const r=pressureNodalForces(load),w=virtualWorkIdentity(load,translation12);
 assert.ok(Math.hypot(...r.resultantReal,...r.resultantImag)>1e-4);
 assert.ok(Math.hypot(...r.momentReal,...r.momentImag)>1e-5);
 assert.ok(Math.hypot(w.pressureWork.real,w.pressureWork.imag)>1e-6);
});

test('the transfer does not modify its input contract',()=>{
 const before=JSON.stringify(octa),displacement={real:Array(18).fill(1e-4),imag:Array(18).fill(0)};
 pressureNodalForces(octa);faceNormalDisplacementIntegral(octa,displacement);virtualWorkIdentity(octa,displacement);
 assert.equal(JSON.stringify(octa),before);
});

test('rejects non-finite input, face-count mismatch, degenerate and duplicate faces, bad closed shells and unknown units',()=>{
 assert.throws(()=>validateCurvedPressure({...triangle,nodes:[0,0,0,10,NaN,0,0,10,0]}),/finite mm nodes/);
 assert.throws(()=>validateCurvedPressure({...triangle,nodes:[0,0,0,10,Infinity,0,0,10,0]}),/finite mm nodes/);
 assert.throws(()=>validateCurvedPressure({...triangle,pressure:[{real:1000,imag:Infinity}]}),/finite complex pressure/);
 assert.throws(()=>validateCurvedPressure({...triangle,pressure:[{real:1,imag:0},{real:1,imag:0}]}),/one pressure per oriented face/);
 assert.throws(()=>validateCurvedPressure({...triangle,nodes:[0,0,0,10,0,0,20,0,0]}),/degenerate face/);
 assert.throws(()=>validateCurvedPressure({...triangle,triangles:[[0,1,2],[2,1,0]],pressure:[{real:1,imag:0},{real:1,imag:0}]}),/duplicate face/);
 assert.throws(()=>validateCurvedPressure({...triangle,surface:'closed'}),/open-edge closed shell/);
 assert.throws(()=>validateCurvedPressure({...octa,triangles:octaTriangles.slice(0,7),pressure:octa.pressure.slice(0,7)}),/open-edge closed shell/);
 assert.throws(()=>validateCurvedPressure({...octa,triangles:[[0,2,4],[4,1,2],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]]}),/inconsistent closed-shell orientation/);
 assert.throws(()=>validateCurvedPressure({...triangle,lengthUnit:'cm'}),/unknown length or pressure unit/);
 assert.throws(()=>validateCurvedPressure({...triangle,pressureUnit:'kPa'}),/unknown length or pressure unit/);
 assert.throws(()=>validateCurvedPressure({...triangle,pressure:[{real:1000,imag:500}],triangles:[[0,1,2]],surface:'Open'}),/open or closed surface/);
 assert.throws(()=>faceNormalDisplacementIntegral(triangle,{real:Array(9).fill(0),imag:Array(8).fill(0)}),/finite complex nodal displacement/);
});

test('numeric-limit counterexample: all-finite 1e308 Pa on a 1e6 mm open triangle is rejected with a typed limit instead of returning Infinity/NaN',()=>{
 const load={lengthUnit:'mm',pressureUnit:'Pa',surface:'open',nodes:[0,0,0,1e6,0,0,0,1e6,0],triangles:[[0,1,2]],pressure:[{real:1e308,imag:0}]};
 assert.ok(load.nodes.every(Number.isFinite)&&Number.isFinite(load.pressure[0].real)&&Number.isFinite(load.pressure[0].imag));
 const displacement={real:Array(9).fill(0),imag:Array(9).fill(0)};
 for(const run of [()=>pressureNodalForces(load),()=>virtualWorkIdentity(load,displacement)])assert.throws(run,error=>error.code==='CURVED_PRESSURE_NUMERIC_LIMIT'&&/finite numeric range/.test(error.message));
});

test('numeric-limit counterexample: 1e308 m nodal displacement on the 10 mm triangle keeps the area-3 weighted integral finite at 5e303 m^3 and the conjugate work finite',()=>{
 const displacement={real:Array(9).fill(0),imag:Array(9).fill(0)};
 for(const i of [2,5,8])displacement.real[i]=1e308;
 const expected=50e-6*1e308,vol=faceNormalDisplacementIntegral(triangle,displacement);
 assert.ok(Number.isFinite(vol.volumeReal[0])&&Number.isFinite(vol.volumeImag[0]));
 assert.ok(Math.abs(vol.volumeReal[0]-expected)/expected<1e-12);
 assert.ok(Math.abs(vol.totalVolumeReal-expected)/expected<1e-12&&vol.totalVolumeImag===0);
 const w=virtualWorkIdentity(triangle,displacement);
 assert.ok(Number.isFinite(w.nodalWork.real)&&Number.isFinite(w.nodalWork.imag)&&Number.isFinite(w.pressureWork.real)&&Number.isFinite(w.pressureWork.imag));
 assert.ok(Math.abs(w.nodalWork.real-(-5e306))/5e306<1e-12);
 assert.ok(Math.abs(w.pressureWork.real-(-5e306))/5e306<1e-12);
 assert.ok(Math.abs(w.pressureWork.imag-(-2.5e306))/2.5e306<1e-12);
 assert.ok(Number.isFinite(w.absoluteErrorJ)&&Number.isFinite(w.relativeErrorJ)&&w.relativeErrorJ<=1e-12);
});
