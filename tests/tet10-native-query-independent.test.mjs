import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {readFileSync} from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {tmpdir} from 'node:os';import {join,dirname,basename} from 'node:path';import {createHash} from 'node:crypto';
import {prepareNativeTet10Result as prepare,sampleNativeTet10Result as sample} from '../src/tet10-native-result.js';
import {queryNativeTet10File as query} from '../scripts/tet10-native-file.mjs';import {getPhysicalRevision,getProjectRevision} from '../src/project-revision.js';
const raw=readFileSync(new URL('../docs/evidence/2026-11-07-tet10-native-query/real-job.json',import.meta.url)),original=JSON.parse(raw),clone=()=>structuredClone(original),near=(a,b,t=1e-8)=>assert(Math.abs(a-b)<t,`${a} vs ${b}`);

test('dense snapshot refuses holes compensated by non-index numeric keys, including physical-hash-excluded performance',async()=>{
 for(const key of ['4294967295','99999999999999999999999999999']){const s=clone();s.result.performance=[1,,3];s.result.performance[key]=0;await assert.rejects(prepare(s),{code:'TET10_NATIVE_INVALID',reason:'own-data-required'});}
 const s=clone();s.result.performance=[1,2,3];const h=await prepare(s),point=[5,,5];point['4294967295']=0;assert.throws(()=>sample(h,point),{code:'TET10_NATIVE_INVALID'});near(sample(h,[5,5,5]).displacementMm[2],.005);
 let hooks=0;s.result.performance=[1,2,3];Object.defineProperty(s.result.performance,'1',{enumerable:true,get(){hooks++;return 2;}});await assert.rejects(prepare(s),{code:'TET10_NATIVE_INVALID'});assert.equal(hooks,0);
 let lengthReads=0;const changingLength=new Proxy([5,5,5],{get(target,key,receiver){if(key==='length'){lengthReads++;return lengthReads===4?16385:3;}return Reflect.get(target,key,receiver);}});near(sample(h,changingLength).displacementMm[2],.005);assert.equal(lengthReads,0);
});

test('independent mixed quadratic shear survives large translation and exact shared-boundary policy without a FEM solve',async()=>{
 const s=clone(),offset=[100000,-200000,300000],u=([x,y,z])=>[.0007*x*y,-.0004*y*z,.0011*z*x],strain=([x,y,z])=>[.0007*y,-.0004*z,.0011*x,.0007*x,-.0004*y,.0011*z],E=1e9,nu=.31,mu=E/(2*(1+nu)),lambda=E*nu/((1+nu)*(1-2*nu));
 const stress=e=>e.map((v,k)=>k<3?lambda*(e[0]+e[1]+e[2])+2*mu*v:mu*v),vm=a=>Math.sqrt(((a[0]-a[1])**2+(a[1]-a[2])**2+(a[2]-a[0])**2)/2+3*(a[3]**2+a[4]**2+a[5]**2));
 s.input.materialProperties.poissonRatio=nu;s.input.sourceModel.bounds.splice(0,3,...offset);s.input.meshes[0].positions=s.input.meshes[0].positions.map((v,i)=>v+offset[i%3]);
 s.result.displacement=Array.from({length:s.mesh.nodes.length/3},(_,i)=>u(s.mesh.nodes.slice(3*i,3*i+3))).flat();s.mesh.nodes=s.mesh.nodes.map((v,i)=>v+offset[i%3]);s.result.magnitudes=Array.from({length:s.mesh.nodes.length/3},(_,i)=>Math.hypot(...s.result.displacement.slice(3*i,3*i+3)));
 for(const g of s.result.gaussPoints){const local=[...g.xMm];g.xMm=g.xMm.map((v,k)=>v+offset[k]);g.stress=stress(strain(local));g.vonMisesPa=vm(g.stress);}s.result.maxDisplacementMm=Math.max(...s.result.magnitudes);s.result.maxVonMisesPa=Math.max(...s.result.gaussPoints.map(g=>g.vonMisesPa));s.job.inputRevision=await getProjectRevision(s.input);const {nativeResultRevision,job,...physical}=s;s.nativeResultRevision=await getPhysicalRevision(physical);
 const h=await prepare(s);for(const p of [[1.125,3.25,7.5],[0,2.5,5],[10,10,10],[5,5,5]]){const q=sample(h,p.map((v,k)=>v+offset[k])),expectedU=u(p),expectedE=strain(p),expectedStress=stress(expectedE);for(let k=0;k<3;k++)near(q.displacementMm[k],expectedU[k],2e-12);for(let k=0;k<6;k++){near(q.engineeringStrain[k],expectedE[k],2e-12);near(q.stressPa[k],expectedStress[k],.001);}near(q.vonMisesPa,vm(expectedStress),.001);assert.equal(q.units.stress,'Pa');assert.equal(q.boundaryPolicy,'lowest-containing-element-index');}
 assert.equal(sample(h,[5,5,5].map((v,k)=>v+offset[k])).elementIndex,0);assert.throws(()=>sample(h,[-1e-5,5,5].map((v,k)=>v+offset[k])),{code:'TET10_NATIVE_OUTSIDE'});
});

test('same-byte replacement of the FD path is refused even though the expected raw SHA remains valid',async t=>{
 const parent=await fs.realpath(tmpdir()),dir=await fs.mkdtemp(join(parent,'tet10-inode-audit-'));assert.equal(dirname(dir),parent);assert(basename(dir).startsWith('tet10-inode-audit-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const path=join(dir,'record.json');await fs.writeFile(path,raw);const actual=await fs.realpath(path),open=fs.open;let replaced=false;
 fs.open=async function(...args){const handle=await open.apply(this,args);if(args[0]!==actual)return handle;return new Proxy(handle,{get(target,k){if(k==='read')return async(...a)=>{const result=await target.read(...a);if(!replaced){replaced=true;await fs.rename(path,join(dir,'old.json'));await fs.writeFile(path,raw);}return result;};const value=Reflect.get(target,k);return typeof value==='function'?value.bind(target):value;}});};syncBuiltinESMExports();
 try{await assert.rejects(query({path,expectedRawSHA256:createHash('sha256').update(raw).digest('hex'),pointMm:[5,5,5]}),{code:'TET10_NATIVE_FILE_INVALID',reason:'input-changed'});assert.equal(replaced,true);assert.deepEqual(await fs.readFile(path),raw);}finally{fs.open=open;syncBuiltinESMExports();}
});
