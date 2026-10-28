import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {zipSync,unzipSync,strToU8} from 'three/addons/libs/fflate.module.js';
import {buildDumbbellSpecimen,writeSpecimen3mf,readSpecimen3mf,validateSpecimenPlan,SPECIMEN_PLAN_PATH} from '../src/printed-measurement-specimen.js';
const xmlOptions={parseXml:text=>new DOMParser({onError:(_level,message)=>{throw Error(message);}}).parseFromString(text,'application/xml')};
// Synthetic dimensions chosen for easy arithmetic; they are not taken from any test standard.
const plan=(over={})=>({specimenId:'synthetic-dumbbell',specimenVersion:1,shape:'dumbbell',dimensionsMm:{overallLength:100,gripWidth:20,narrowWidth:10,parallelLength:40,filletRadius:5,thickness:4},orientation:'flat',process:{layerHeight:.2,wallLoops:2,infillDensity:1,infillPattern:'rectilinear',topShellLayers:3,bottomShellLayers:3},...over});
function volume(mesh){let v=0;for(const [a,b,c] of mesh.triangles){const [p,q,r]=[a,b,c].map(i=>mesh.vertices[i]);v+=(p[0]*(q[1]*r[2]-q[2]*r[1])-p[1]*(q[0]*r[2]-q[2]*r[0])+p[2]*(q[0]*r[1]-q[1]*r[0]))/6;}return v;}
function edgesClosed(mesh){const e=new Map();for(const t of mesh.triangles)for(let i=0;i<3;i++){const k=t[i]+','+t[(i+1)%3];e.set(k,(e.get(k)??0)+1);}return [...e.keys()].every(k=>{const [a,b]=k.split(',');return e.get(k)===1&&e.get(b+','+a)===1;});}

test('dumbbell outline gives closed outward mesh with the analytic volume',()=>{
 // Fillet R=5 with width step 5 is a quarter circle: area = 10*40 + 20*50 + 2*10*5 + 4*(25 - pi*25/4).
 const exact=(10*40+20*50+2*10*5+4*(25-Math.PI*25/4))*4;
 for(const orientation of ['flat','on-edge','upright']){const m=buildDumbbellSpecimen(plan({orientation}),{arcSegments:256});
  assert.ok(edgesClosed(m),orientation);const v=volume(m);assert.ok(v>0,orientation+' outward');assert.ok(Math.abs(v-exact)/exact<2e-4,`${orientation} volume ${v} vs ${exact}`);assert.equal(m.boundsMm[2],0);}
 assert.deepEqual(buildDumbbellSpecimen(plan()).boundsMm,[-50,-10,0,50,10,4]);
 assert.deepEqual(buildDumbbellSpecimen(plan({orientation:'on-edge'})).boundsMm,[-50,-2,0,50,2,20]);
 assert.deepEqual(buildDumbbellSpecimen(plan({orientation:'upright'})).boundsMm,[-10,-2,0,10,2,100]);
});

test('plan validation rejects impossible geometry and unknown fields without inventing defaults',()=>{
 const d=plan().dimensionsMm;
 assert.throws(()=>validateSpecimenPlan(plan({dimensionsMm:{...d,narrowWidth:20}})),/smaller than gripWidth/);
 assert.throws(()=>validateSpecimenPlan(plan({dimensionsMm:{...d,filletRadius:2}})),/tangent transition/);
 assert.throws(()=>validateSpecimenPlan(plan({dimensionsMm:{...d,overallLength:50}})),/no grip length/);
 assert.throws(()=>validateSpecimenPlan(plan({dimensionsMm:{...d,thickness:NaN}})),/finite/);
 const {thickness,...noThickness}=d;assert.throws(()=>validateSpecimenPlan(plan({dimensionsMm:noThickness})),/missing \[thickness\]/);
 assert.throws(()=>validateSpecimenPlan(plan({process:{...plan().process,nozzleTemperature:220}})),/extra \[nozzleTemperature\]/);
 assert.throws(()=>validateSpecimenPlan(plan({process:{...plan().process,infillDensity:15}})),/fraction/);
 assert.throws(()=>validateSpecimenPlan(plan({orientation:'diagonal'})),/orientation/);
 assert.throws(()=>validateSpecimenPlan(plan({specimenId:'bad id/..'})),/specimenId/);
});

test('3MF package round-trips through the existing importer with plan, hashes and bounds',async()=>{
 for(const orientation of ['flat','on-edge','upright']){const p=plan({orientation}),out=await writeSpecimen3mf(p);
  assert.equal(out.fileName,'synthetic-dumbbell-v1.3mf');const back=await readSpecimen3mf(out.bytes,xmlOptions);
  assert.deepEqual(back.plan,p);assert.deepEqual(back.boundsMm,out.record.geometry.boundsMm);assert.equal(back.triangleCount,out.record.geometry.triangleCount);
  assert.equal(back.record.slicedSettings,null);assert.ok(back.record.userChosenSettings.includes('nozzleTemperature'));}
 const a=await writeSpecimen3mf(plan()),b=await writeSpecimen3mf(plan());assert.equal(a.sha256,b.sha256,'reproducible bytes');
 assert.notEqual((await writeSpecimen3mf(plan({process:{...plan().process,layerHeight:.12}}))).sha256,a.sha256);
});

test('tampered plan or geometry is rejected on re-read',async()=>{
 const {bytes}=await writeSpecimen3mf(plan()),files=unzipSync(bytes),record=JSON.parse(new TextDecoder().decode(files[SPECIMEN_PLAN_PATH]));
 const repack=f=>zipSync(f);
 record.plan.process.layerHeight=.3;await assert.rejects(readSpecimen3mf(repack({...files,[SPECIMEN_PLAN_PATH]:strToU8(JSON.stringify(record))}),xmlOptions),/plan hash mismatch/);
 const model=new TextDecoder().decode(files['3D/3dmodel.model']).replace('x="-50"','x="-49"');
 await assert.rejects(readSpecimen3mf(repack({...files,'3D/3dmodel.model':strToU8(model)}),xmlOptions),/geometry hash mismatch/);
 const {[SPECIMEN_PLAN_PATH]:_,...noPlan}=files;await assert.rejects(readSpecimen3mf(repack(noPlan),xmlOptions),/no measurement specimen plan/);
});
