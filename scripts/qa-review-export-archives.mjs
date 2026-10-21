// Real process-isolated synthetic solves for actual browser export QA.
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {analyzeProject} from './headless-analysis.mjs';
import {createCaseStore} from '../src/cases.js';
const kind=process.argv[2];assert.ok(['structural','acoustic'].includes(kind),'Choose structural or acoustic');
const target=pathToFileURL(resolve(process.argv[3]??`.qa/review-export-${kind}`)+sep);
await mkdir(target,{recursive:true});assert.equal((await readdir(target)).length,0,'Use a new empty output directory');
const hash=b=>createHash('sha256').update(b).digest('hex'),cases=[],records=[];
for(const amplitude of kind==='structural'?[100]:[1,2]){
 const p=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]},name:`Synthetic ${kind} ${amplitude}${kind==='structural'?'N':'Pa'}`});
 const pos=p.meshes[0].positions,face=z=>p.meshes[0].faceIds.map((_,i)=>i).filter(i=>[2,5,8].every(k=>Math.abs(pos[i*9+k]-z)<1e-8));
 if(kind==='structural'){
  p.study={kind,gravityEnabled:false};p.materialProperties={youngModulus:1e9,poissonRatio:.3};
  p.conditions=[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:amplitude,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}];
 }else{
  p.study={kind,acousticTransient:true,frequency:4000,soundSpeed:343,airDensity:1.2,lossFactor:0,pulseWidth:.0001,acousticDuration:.0012,receiverPoint:[5,5,20],acousticSnapshotCount:25,acousticSnapshotBudgetBytes:65536};
  p.materialProperties={};p.conditions=[{type:'acousticPressure',value:amplitude,direction:[1,0,0],regions:[{mesh:0,triangles:face(0)}]}];
 }
 const inputBytes=JSON.stringify(p),output=await analyzeProject(p,{size:kind==='structural'?5:3,method:'pcg'},'elastic',{isolation:'process'});
 assert.equal(JSON.stringify(p),inputBytes);cases.push({name:p.name,output});
 records.push({amplitude,inputSha256:hash(inputBytes),nodeCount:output.mesh.nodes.length/3,frameCount:output.result.snapshots?.length??0,runtime:output.calculation.runtimeIdentity});
}
if(kind==='acoustic'){
 assert.deepEqual(cases[0].output.mesh,cases[1].output.mesh);
 for(let f=0;f<cases[0].output.result.snapshots.length;f++){
  const a=cases[0].output.result.snapshots[f],b=cases[1].output.result.snapshots[f];assert.equal(a.time,b.time);
  a.pressure.forEach((v,i)=>assert.ok(Math.abs(b.pressure[i]-2*v)<1e-9));
 }
}
const archive={version:1,cases};createCaseStore().import(archive);
const bytes=JSON.stringify(archive,null,2)+'\n';await writeFile(new URL('cases.json',target),bytes,{flag:'wx'});
assert.equal(JSON.stringify(JSON.parse(await readFile(new URL('cases.json',target),'utf8'))),JSON.stringify(archive));
const evidence={schemaVersion:1,sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),helperSha256:hash(await readFile(new URL(import.meta.url))),node:process.version,scope:'Actual synthetic headless process solves. Not browser rendering, not MCP export acceptance or independent material validation.',archiveSha256:hash(bytes),archiveBytes:Buffer.byteLength(bytes),records,cleanup:'Owned child processes settled before each analyzeProject resolved; no browser or server started.'};
await writeFile(new URL('headless-readbacks.json',target),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({kind,target:target.pathname,records:records.map(({amplitude,nodeCount,frameCount})=>({amplitude,nodeCount,frameCount}))}));
