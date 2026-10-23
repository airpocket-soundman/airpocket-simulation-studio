import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {buildCurvedPressureTransferOperator as build,serializeCurvedPressureTransferOperator as serialize,loadCurvedPressureTransferOperator as load,applyCurvedPressureTransferOperator as apply,applyCurvedPressureTranspose as transpose,evaluateCurvedPressureVirtualWork as work,CURVED_PRESSURE_OPERATOR_LIMITS as LIMITS} from '../src/curved-pressure-operator.js';
import {pressureNodalForces,faceNormalDisplacementIntegral,virtualWorkIdentity} from '../src/curved-pressure-transfer.js';
import {getProjectRevision} from '../src/project-revision.js';
const triangle=()=>({lengthUnit:'mm',surface:'open',nodes:[0,0,0,2,0,0,0,3,0],triangles:[[0,1,2]]});
const pressure=(real=2,imag=3)=>({units:'Pa',values:[{real,imag}]});
const u=()=>({units:'m',real:[0,0,.001,0,0,.002,0,0,.004],imag:[0,0,-.001,0,0,.003,0,0,.002]});
const near=(a,b,abs=1e-18,rel=1e-12)=>assert.ok(Math.abs(a-b)<=abs+rel*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const skew=()=>({lengthUnit:'mm',surface:'closed',nodes:[2,3,5,22,3,5,2,33,5,2,3,45],triangles:[[0,2,1],[0,1,3],[1,2,3],[2,0,3]]});

test('independent 2x3mm triangle complex force, centroid moment, transpose and conjugate work have exact SI oracles',async()=>{
 const g=triangle(),before=structuredClone(g),op=await build(g),q=pressure(),displacement=u(),f=await apply(op,g,q),v=await transpose(op,g,displacement),w=await work(op,g,q,displacement);
 assert.equal(op.faces[0].areaMm2,3);near(op.faces[0].areaWeightM2,1e-6);assert.deepEqual(op.faces[0].outwardNormal,[0,0,1]);
 for(const node of [0,1,2]){near(f.forceReal[3*node+2],-2e-6);near(f.forceImag[3*node+2],-3e-6);assert.equal(f.forceReal[3*node],0);}
 near(f.resultantReal[2],-6e-6);near(f.resultantImag[2],-9e-6);[-6e-9,4e-9,0].forEach((expected,k)=>near(f.momentReal[k],expected));[-9e-9,6e-9,0].forEach((expected,k)=>near(f.momentImag[k],expected));
 near(v.volumeReal[0],7e-9);near(v.volumeImag[0],4e-9);near(w.nodalWork.real,-26e-9);near(w.nodalWork.imag,-13e-9);near(w.pressureWork.real,-26e-9);near(w.pressureWork.imag,-13e-9);near(w.absoluteErrorJ,0);assert.equal(op.scope.solverConnected,false);assert.deepEqual(g,before);
});
test('noncoplanar closed shell matches independent SI area-vector/centroid moments and complex rigid-mode work after translation',async()=>{
 const q={units:'Pa',values:[{real:1000,imag:300},{real:1350,imag:200},{real:1700,imag:100},{real:2050,imag:0}]};let original;
 for(const shift of [[0,0,0],[1000,-2000,3000]]){
  const g=skew();g.nodes=g.nodes.map((v,i)=>v+shift[i%3]);const op=await build(g),f=await apply(op,g,q),expected={real:[0,0,0],imag:[0,0,0],momentReal:[0,0,0],momentImag:[0,0,0]};
  for(const [index,face]of g.triangles.entries()){
   const [a,b,c]=face.map(node=>g.nodes.slice(3*node,3*node+3).map(x=>x/1000)),av=cross(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k])).map(x=>x/2),centroid=a.map((v,k)=>(v+b[k]+c[k])/3);
   for(const component of ['real','imag']){const force=av.map(x=>-q.values[index][component]*x),moment=cross(centroid,force),key=component==='real'?'momentReal':'momentImag';for(let k=0;k<3;k++){expected[component][k]+=force[k];expected[key][k]+=moment[k];}}
  }
  for(const [actual,key]of [[f.resultantReal,'real'],[f.resultantImag,'imag'],[f.momentReal,'momentReal'],[f.momentImag,'momentImag']])actual.forEach((x,k)=>near(x,expected[key][k],1e-14));
  const t={real:[.001,-.002,.003],imag:[-.002,.001,.001]},theta={real:[.01,-.02,.03],imag:[.02,.03,-.01]},displacement={units:'m',real:[],imag:[]};
  for(let node=0;node<4;node++){const position=g.nodes.slice(3*node,3*node+3).map(x=>x/1000);for(const component of ['real','imag'])displacement[component].push(...cross(theta[component],position).map((x,k)=>x+t[component][k]));}
  const w=await work(op,g,q,displacement);let real=0,imag=0;
  for(let k=0;k<3;k++){real+=t.real[k]*expected.real[k]+t.imag[k]*expected.imag[k]+theta.real[k]*expected.momentReal[k]+theta.imag[k]*expected.momentImag[k];imag+=t.real[k]*expected.imag[k]-t.imag[k]*expected.real[k]+theta.real[k]*expected.momentImag[k]-theta.imag[k]*expected.momentReal[k];}
  near(w.nodalWork.real,real,1e-14);near(w.nodalWork.imag,imag,1e-14);near(w.pressureWork.real,real,1e-14);near(w.pressureWork.imag,imag,1e-14);
  if(original){const arm=shift.map(x=>x/1000);for(const [force,moment,old]of [[f.resultantReal,f.momentReal,original.momentReal],[f.resultantImag,f.momentImag,original.momentImag]])cross(arm,force).forEach((x,k)=>near(moment[k],old[k]+x,1e-14));}else original=f;
 }
});
test('existing API numerical behavior and multiplication order are preserved, including huge but finite displacement',async()=>{
 const g=triangle();g.nodes=[0,0,0,10,0,0,0,10,0];const op=await build(g),q=pressure(1000,500),displacement={units:'m',real:Array(9).fill(0),imag:Array(9).fill(0)};[2,5,8].forEach(i=>{displacement.real[i]=1e308;});
 const old={...g,pressureUnit:'Pa',pressure:q.values},f=await apply(op,g,q),v=await transpose(op,g,displacement),w=await work(op,g,q,displacement),of=pressureNodalForces(old),ov=faceNormalDisplacementIntegral(old,displacement),ow=virtualWorkIdentity(old,displacement);
 for(const key of ['forceReal','forceImag','resultantReal','resultantImag','momentReal','momentImag'])assert.deepEqual(f[key],of[key]);assert.deepEqual(v.volumeReal,ov.volumeReal);assert.deepEqual(v.volumeImag,ov.volumeImag);near(v.volumeReal[0],5e303,0);near(w.pressureWork.real,-5e306,0);near(w.pressureWork.imag,-2.5e306,0);near(w.pressureWork.real,ow.pressureWork.real,0);
});
test('closed uniform pressure keeps nonzero nodal loads while rigid translation and total force/work cancel',async()=>{
 const g=skew(),op=await build(g),q={units:'Pa',values:g.triangles.map(()=>({real:2,imag:-3}))},displacement={units:'m',real:Array.from({length:12},(_,i)=>[.001,.002,-.001][i%3]),imag:Array(12).fill(0)},f=await apply(op,g,q),w=await work(op,g,q,displacement);
 assert.ok(f.forceReal.some(x=>Math.abs(x)>1e-6));[...f.resultantReal,...f.resultantImag].forEach(x=>near(x,0));near(w.pressureWork.real,0);near(w.pressureWork.imag,0);
 const zero=await work(op,g,{units:'Pa',values:g.triangles.map(()=>({real:0,imag:0}))},displacement);assert.equal(zero.scaleJ,0);assert.equal(zero.relativeErrorJ,0);
});
test('phase, winding, geometry identity and field identities are explicit',async()=>{
 const g=triangle(),op=await build(g),a=await apply(op,g,pressure(2,0)),b=await apply(op,g,pressure(0,2));assert.notEqual(a.pressureRevision,b.pressureRevision);near(a.forceReal[2],b.forceImag[2]);assert.equal(b.forceReal[2],0);
 const reversed=triangle();reversed.triangles[0].reverse();await assert.rejects(apply(op,reversed,pressure()),/identity/);const reverse=await apply(await build(reversed),reversed,pressure());near(reverse.forceReal[2],-a.forceReal[2]);
 const bad=triangle();bad.nodes[0]=.01;await assert.rejects(transpose(op,bad,u()),/identity/);await assert.rejects(work(op,bad,pressure(),u()),/identity/);
});
test('save/load rederives factors and rejects self-rehashed edits; raw source hash is independent',async()=>{
 const g=triangle(),op=await build(g),raw=serialize(op),loaded=await load(raw,g);assert.equal(serialize(loaded.operator),raw);assert.equal(loaded.source.rawIdentity,'sha256:'+createHash('sha256').update(raw).digest('hex'));
 for(const change of [x=>x.faces[0].areaWeightM2*=2,x=>x.faces[0].outwardNormal[2]=-1,x=>x.faces[0].nodeIds.reverse(),x=>x.surface='closed',x=>x.units.displacement='mm',x=>x.scope.solverConnected=true,x=>x.extra=true]){const bad=JSON.parse(raw);change(bad);const {operatorRevision,...payload}=bad;bad.operatorRevision=await getProjectRevision(payload);await assert.rejects(load(JSON.stringify(bad),g),/differs/);}
 assert.throws(()=>serialize(JSON.parse(raw)),/issued/);await assert.rejects(apply(JSON.parse(raw),g,pressure()),/issued/);assert.ok(Object.isFrozen(op.faces[0].outwardNormal));
});
test('all inputs are snapshotted before hash awaits and outputs remain detached',async()=>{
 const g=triangle(),original=structuredClone(g),pending=build(g);g.nodes[0]=99;const op=await pending;const q=pressure(),displacement=u(),f=apply(op,original,q),v=transpose(op,original,displacement),w=work(op,original,q,displacement);q.values[0].real=999;displacement.real[2]=999;near((await f).forceReal[2],-2e-6);near((await v).volumeReal[0],7e-9);near((await w).nodalWork.real,-26e-9);
 const fresh=triangle(),raw=serialize(op),loading=load(raw,fresh);fresh.nodes[0]=99;assert.equal(serialize((await loading).operator),raw);
});
test('invalid geometry/units/fields, accessors, spoofed arrays, finite overflow and unsupported record fields reject',async()=>{
 for(const change of [g=>g.lengthUnit='m',g=>g.surface='closed',g=>g.nodes[0]=null,g=>g.nodes[0]=true,g=>g.nodes[0]='0',g=>g.nodes[0]=Infinity,g=>g.triangles.push([0,1,2]),g=>g.triangles[0]=[0,0,2],g=>g.extra=1]){const g=triangle();change(g);await assert.rejects(build(g));}
 let touched=false;const bad=triangle();Object.defineProperty(bad.nodes,'0',{get(){touched=true;throw Error();}});await assert.rejects(build(bad));assert.equal(touched,false);
 const spoof=triangle();Object.setPrototypeOf(spoof.nodes,{map:()=>[],some:()=>false});await assert.rejects(build(spoof));
 const g=triangle(),op=await build(g);for(const q of [{units:'kPa',values:pressure().values},{units:'Pa',values:[]},{units:'Pa',values:[{real:true,imag:0}]},{units:'Pa',values:[{real:1,imag:0,extra:0}]}])await assert.rejects(apply(op,g,q));await assert.rejects(transpose(op,g,{...u(),units:'mm'}));
 const huge=triangle();huge.nodes=[0,0,0,1e6,0,0,0,1e6,0];const big=await build(huge);await assert.rejects(apply(big,huge,pressure(1e308,0)),e=>e.code==='CURVED_PRESSURE_OPERATOR_NUMERIC_LIMIT');
});
test('node/face capacities and exact raw UTF8 byte limit are enforced before large allocations',async()=>{
 const g=triangle();g.nodes=Array(LIMITS.nodes*3).fill(0);g.nodes.splice(0,9,...triangle().nodes);assert.equal((await build(g)).nodeCount,LIMITS.nodes);
 const faces=triangle();faces.nodes=[];faces.triangles=[];for(let i=0;i<LIMITS.faces;i++){faces.nodes.push(2*i,0,0,2*i+1,0,0,2*i,1,0);faces.triangles.push([3*i,3*i+1,3*i+2]);}while(faces.nodes.length<LIMITS.nodes*3)faces.nodes.push(0,0,0);const maximum=await build(faces);assert.equal(maximum.faces.length,LIMITS.faces);assert.equal(maximum.nodeCount,LIMITS.nodes);const maximumLoad=await apply(maximum,faces,{units:'Pa',values:faces.triangles.map(()=>({real:2,imag:3}))});near(maximumLoad.resultantReal[2],-512e-6);near(maximumLoad.resultantImag[2],-768e-6);
 const tooMany=triangle();tooMany.triangles=Array(LIMITS.faces+1).fill([0,1,2]);await assert.rejects(build(tooMany),/capacity/);const tooManyNodes=triangle();tooManyNodes.nodes.length=LIMITS.nodes*3+3;await assert.rejects(build(tooManyNodes),/capacity/);
 const raw=serialize(await build(triangle())),exact=raw+' '.repeat(LIMITS.bytes-Buffer.byteLength(raw));assert.equal((await load(exact,triangle())).source.bytes,LIMITS.bytes);await assert.rejects(load(exact+' ',triangle()),/byte/);await assert.rejects(load('['.repeat(13)+'0'+']'.repeat(13),triangle()),/depth/);
});
test('factored weights preserve tiny-normal pressure components that an eager coefficient would underflow',async()=>{
 const g=triangle();g.nodes[5]=-2e-320;const op=await build(g),q=pressure(1e308,0),f=await apply(op,g,q),old=pressureNodalForces({...g,pressureUnit:'Pa',pressure:q.values});
 assert.equal(op.faces[0].areaWeightM2*op.faces[0].outwardNormal[0],0);assert.ok(Math.abs(f.forceReal[0])>0);assert.deepEqual(f.forceReal,old.forceReal);assert.ok(f.forceReal.every(Number.isFinite));
});
test('public runtime import enforces immutable factors and pressure/displacement/wrapper types',async()=>{
 const {spawnSync}=await import('node:child_process');const r=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--strict','--noEmit','--skipLibCheck','false','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','tests/fixtures/curved-pressure-operator-types.ts'],{encoding:'utf8',timeout:30000});assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);
});
