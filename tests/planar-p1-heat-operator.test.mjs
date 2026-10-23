import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {buildPlanarP1HeatTransferOperator as build,applyPlanarP1HeatTransferOperator as apply,serializePlanarP1HeatTransferOperator as serialize,loadPlanarP1HeatTransferOperator as load} from '../src/planar-p1-heat-operator.js';
import {buildPlanarHeatTransferOperator as affineBuild,applyPlanarHeatTransferOperator as affineApply,serializePlanarHeatTransferOperator as affineSerialize} from '../src/planar-heat-operator.js';
import {getProjectRevision} from '../src/project-revision.js';
const corner=[0,0,0,1,0,0,1,1,0,0,1,0];
const crossing=()=>({units:'mm',mesh:{nodes:[...corner,...corner]},sourceFaces:[{nodes:[0,1,2]},{nodes:[0,2,3]}],targetFaces:[{nodes:[4,7,5]},{nodes:[5,7,6]}]});
const hat=()=>({units:'mm',mesh:{nodes:[...corner,.5,.5,0,...corner]},sourceFaces:[[0,1,4],[1,2,4],[2,3,4],[3,0,4]].map(nodes=>({nodes})),targetFaces:[{nodes:[5,7,6]},{nodes:[5,8,7]}]});
const field=values=>({units:'W/m2',values:values.map((value,nodeId)=>({nodeId,value}))});
const near=(a,b,abs=1e-18,rel=1e-12)=>assert.ok(Math.abs(a-b)<=abs+rel*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const matrix=[[5,1,1,1],[5,5,5,1],[1,1,5,1],[5,1,5,5]].map(row=>row.map(v=>v*1e-6/48));

test('independent crossing-diagonal common-refinement matrix validates every source/target basis and both partitions of unity',async()=>{
 const g=crossing(),before=structuredClone(g),op=await build(g);assert.equal(op.kind,'planar-p1-heat-transfer');for(let j=0;j<4;j++)for(let i=0;i<4;i++)near(op.rows[j].terms.find(t=>t.sourceNodeId===i)?.coefficientM2??0,matrix[j][i]);
 for(let i=0;i<4;i++)near(op.sourceWeights[i].areaM2,[1/3,1/6,1/3,1/6][i]*1e-6);
 const q=[0,0,1,0],r=await apply(op,g,field(q));[1,5,5,5].forEach((v,j)=>near(r.nodeHeatW.get(j+4),v/48*1e-6));near(r.sourceW,1e-6/3);near(r.targetW,1e-6/3);near(r.targetOutwardW,-1e-6/3);near(r.balanceErrorW,0);assert.deepEqual(g,before);
});

test('non-global-affine center hat integrates to distinct nodal loads without averaging q',async()=>{
 const g=hat(),op=await build(g),r=await apply(op,g,field([0,0,0,0,6]));[.75,.25,.75,.25].forEach((v,j)=>near(r.nodeHeatW.get(j+5),v*1e-6));near(r.sourceW,2e-6);near(r.targetW,2e-6);assert.notEqual(r.nodeHeatW.get(5),r.nodeHeatW.get(6));
});

test('mixed-sign zero-total field preserves nonzero nodal loads, reverses sign and never divides by a zero total',async()=>{
 const g=crossing(),op=await build(g),q=field([1,0,-1,0]),r=await apply(op,g,q),reverse=await apply(op,g,field([-1,0,1,0]));near(r.sourceW,0);near(r.targetW,0);[1/12,0,-1/12,0].forEach((v,j)=>{near(r.nodeHeatW.get(j+4),v*1e-6);near(reverse.nodeHeatW.get(j+4),-v*1e-6);});assert.notEqual(r.fluxRevision,reverse.fluxRevision);
});

test('constant/global-affine nodal inputs reproduce old affine output while old API and serialization remain unchanged',async()=>{
 const g=crossing(),old=await affineBuild(g),raw=affineSerialize(old),op=await build(g);for(const [flux,values]of [[2,[2,2,2,2]],[{base:1,gradient:[2000,-500,0]},[1,3,2.5,.5]]]){const a=await affineApply(old,g,flux),b=await apply(op,g,field(values));near(a.sourceW,b.sourceW);near(a.targetW,b.targetW);for(const [id,value]of a.nodeHeatW)near(value,b.nodeHeatW.get(id));}assert.equal(affineSerialize(old),raw);await assert.rejects(affineApply(old,g,field([1,2,3,4])),/affine/);
});

test('serialized coefficients reload only after geometry rederivation; raw hash is independently checked and rehashed forgery is refused',async()=>{
 const g=crossing(),op=await build(g),raw=serialize(op),loaded=await load(raw,g);assert.equal(loaded.source.rawIdentity,'sha256:'+createHash('sha256').update(raw).digest('hex'));assert.equal(serialize(loaded.operator),raw);const result=await apply(loaded.operator,g,field([1,0,-1,0]));near(result.targetW,0);
 const forged=JSON.parse(raw);forged.rows[0].terms[0].coefficientM2+=1e-8;const {operatorRevision,...payload}=forged;forged.operatorRevision=await getProjectRevision(payload);await assert.rejects(load(JSON.stringify(forged),g),/coefficients/);
 for(const change of [x=>x.sourceWeights[0].areaM2+=1e-8,x=>x.kind='planar-affine-heat-transfer',x=>x.units.flux='W',x=>x.extra=true]){const bad=JSON.parse(raw);change(bad);await assert.rejects(load(JSON.stringify(bad),g));}assert.throws(()=>serialize(JSON.parse(raw)),/trusted/);
});

test('geometry/flux mutations across hash awaits cannot change detached compilation or application',async()=>{
 const g=crossing(),before=structuredClone(g),pending=build(g);g.mesh.nodes[0]=99;const op=await pending;const q=field([0,0,1,0]),p=apply(op,before,q);q.values[2].value=999;const r=await p;near(r.sourceW,1e-6/3);await assert.rejects(apply(op,g,field([0,0,1,0])),/revision/);
 const raw=serialize(op),loadPending=load(raw,before);before.mesh.nodes[0]=99;assert.equal(serialize((await loadPending).operator),raw);
});

test('geometry rejection preserves full coverage, opposite normal and same-side overlap/gap protections',async()=>{
 for(const change of [g=>g.targetFaces[0].nodes.reverse(),g=>g.targetFaces.pop(),g=>g.sourceFaces.push(structuredClone(g.sourceFaces[0])),g=>g.targetFaces[0].nodes=[4,4,5],g=>g.mesh.nodes[2]=.01,g=>g.units='m',g=>g.sourceFaces[0].nodes[0]=100,g=>g.mesh.nodes[0]=Infinity]){const g=crossing();change(g);const before=structuredClone(g);await assert.rejects(build(g));assert.deepEqual(g,before);}
 // Equal global bounds/area but duplicate half-triangle: gap and overlap must not cancel.
 const g=crossing();g.targetFaces=[{nodes:[4,6,5]},{nodes:[4,6,5]}];await assert.rejects(build(g),/overlap/);
});

test('coplanar rotations/translations retain scalar integral and numeric overflow/refusals do not mutate input',async()=>{
 const g=crossing();for(let i=0;i<g.mesh.nodes.length;i+=3){const x=g.mesh.nodes[i],y=g.mesh.nodes[i+1];g.mesh.nodes.splice(i,3,12+x*.6,20+y,30+x*.8);}const op=await build(g),r=await apply(op,g,field([0,0,1,0]));near(r.sourceW,1e-6/3);[1,5,5,5].forEach((v,j)=>near(r.nodeHeatW.get(j+4),v/48*1e-6));
 for(const q of [{units:'W',values:field([1,2,3,4]).values},field([1,2,3]),field([1,2,3,Infinity]),{units:'W/m2',values:[{nodeId:0,value:1},{nodeId:0,value:2},{nodeId:2,value:3},{nodeId:3,value:4}]},field([1,2,3,4]).values])await assert.rejects(apply(op,g,q));
 const huge=crossing();huge.mesh.nodes=huge.mesh.nodes.map(v=>v*1e6);const big=await build(huge),q=field([1e308,1e308,1e308,1e308]),before=structuredClone(q);await assert.rejects(apply(big,huge,q),/Nonfinite/);assert.deepEqual(q,before);
});

test('untrusted arrays/accessors and persistence byte/depth/face/node capacities are bounded',async()=>{
 const g=crossing();class Bad extends Array{}g.mesh.nodes=new Bad(...g.mesh.nodes);await assert.rejects(build(g));let touched=false;const h=crossing();Object.defineProperty(h.mesh.nodes,'0',{get(){touched=true;throw Error('must not read');}});await assert.rejects(build(h));assert.equal(touched,false);
 const large=crossing();large.sourceFaces=Array.from({length:513},()=>({nodes:[0,1,2]}));await assert.rejects(build(large),/capacity/);const nodes=crossing();nodes.mesh.nodes=Array(4097*3).fill(0);await assert.rejects(build(nodes),/nodes/);await assert.rejects(load(' '.repeat(1048577),crossing()),/byte/);await assert.rejects(load('['.repeat(21)+'0'+']'.repeat(21),crossing()),/depth/);
});

test('real sparse capacity refuses before a 16385th node pair and exact JSON input byte limit is enforced',async()=>{
 const fan=n=>{const ring=Array.from({length:n},(_,i)=>[Math.cos(2*Math.PI*i/n),Math.sin(2*Math.PI*i/n),0]);return {units:'mm',mesh:{nodes:[-.7,0,0,...ring.flat(),.7,0,0,...ring.flat()]},sourceFaces:Array.from({length:n},(_,i)=>({nodes:[0,i+1,(i+1)%n+1]})),targetFaces:Array.from({length:n},(_,i)=>({nodes:[n+1,n+2+(i+1)%n,n+2+i]}))};};
 const valid=fan(128),op=await build(valid);assert.equal(op.rows.reduce((n,row)=>n+row.terms.length,0),4672);const over=fan(256),before=structuredClone(over);await assert.rejects(build(over),/sparse coefficient capacity/);assert.deepEqual(over,before);
 const small=await build(crossing()),raw=serialize(small),exact=raw+' '.repeat(1048576-Buffer.byteLength(raw)),loaded=await load(exact,crossing());assert.equal(loaded.source.bytes,1048576);assert.equal(loaded.source.rawIdentity,'sha256:'+createHash('sha256').update(exact).digest('hex'));await assert.rejects(load(exact+' ',crossing()),/byte/);
});

test('public runtime type fixtures distinguish P1 flux units, immutable coefficients and loaded wrappers',async()=>{
 const {spawnSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url');const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--strict','--noEmit','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--types','','tests/fixtures/planar-p1-heat-operator-types.ts'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:30000,maxBuffer:65536});assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
});

test('exact 4096-node and 512-face geometry capacities accept a conforming full-coverage interface',async()=>{
 const n=512,ring=Array.from({length:n},(_,i)=>[Math.cos(2*Math.PI*i/n),Math.sin(2*Math.PI*i/n),0]),nodes=[0,0,0,...ring.flat(),0,0,0,...ring.flat()];while(nodes.length<4096*3)nodes.push(0,0,0);const g={units:'mm',mesh:{nodes},sourceFaces:Array.from({length:n},(_,i)=>({nodes:[0,i+1,(i+1)%n+1]})),targetFaces:Array.from({length:n},(_,i)=>({nodes:[n+1,n+2+(i+1)%n,n+2+i]}))},op=await build(g),r=await apply(op,g,{units:'W/m2',values:op.sourceWeights.map(({nodeId})=>({nodeId,value:2}))});near(r.sourceW,n*Math.sin(2*Math.PI/n)*1e-6);near(r.targetW,r.sourceW);
});
