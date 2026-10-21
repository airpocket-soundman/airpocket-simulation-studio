// Replays synthetic, real headless solves; does not certify Chrome or physical accuracy.
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {analyzeProject} from './headless-analysis.mjs';
import {createCaseStore} from '../src/cases.js';
import {createResultViewApi} from '../src/result-view-api.js';
const target=pathToFileURL(resolve(process.argv[2]??'.qa/review49-real-archives')+sep);
const sha=b=>createHash('sha256').update(b).digest('hex');
const validateCaseArchive=archive=>createCaseStore().import(archive);
await mkdir(target,{recursive:true});
assert.equal((await readdir(target)).length,0,'Use a new empty QA output directory; existing evidence must not be overwritten');
const publish=(name,bytes)=>writeFile(new URL(name,target),bytes,{flag:'wx'});
const cases=[],records=[];
for(const kind of ['thermal','acoustic']){
 const input=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]},name:`Synthetic ${kind} history QA`});
 if(kind==='thermal'){
  input.study={kind,transient:true,timeStep:1,steps:10,initialTemperature:20,volumetricSource:1e6,thermalSnapshotCount:11,thermalSnapshotBudgetBytes:2400};
  input.materialProperties={conductivity:1,density:1000,specificHeat:1000};
 }else{
  input.study={kind,acousticTransient:true,frequency:4000,soundSpeed:343,airDensity:1.2,lossFactor:0,pulseWidth:.0001,acousticDuration:.0012,receiverPoint:[5,5,20],acousticSnapshotCount:7,acousticSnapshotBudgetBytes:65536};
  input.materialProperties={};
  const p=input.meshes[0].positions,triangles=input.meshes[0].faceIds.map((_,i)=>i).filter(i=>[2,5,8].every(k=>Math.abs(p[i*9+k])<1e-8));
  input.conditions=[{type:'acousticPressure',value:1,direction:[1,0,0],regions:[{mesh:0,triangles}]}];
 }
 const inputBytes=JSON.stringify(input),start=Date.now();
 const output=await analyzeProject(input,{size:kind==='thermal'?5:3,method:'pcg'},'elastic',{isolation:'process'});
 assert.equal(JSON.stringify(input),inputBytes);
 const archive={version:1,cases:[{name:`Synthetic ${kind} actual Worker solve`,output}]};
 validateCaseArchive(archive);
 const bytes=JSON.stringify(archive,null,2)+'\n';await publish(`${kind}.json`,bytes);
 const reloaded=JSON.parse(await readFile(new URL(`${kind}.json`,target),'utf8'));
 // Saved JSON canonicalizes -0 to 0; compare the actual persisted JSON contract.
 validateCaseArchive(reloaded);assert.equal(JSON.stringify(reloaded),JSON.stringify(archive));
 const camera={position:[50,60,70],target:[5,5,20],up:[0,1,0],fov:40};
 const summary=async out=>createResultViewApi({getAnalysis:()=>out,get:()=>({field:kind==='thermal'?'temperature':'instantPressure',modeIndex:null,frameIndex:0,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:false,colorRange:null,camera})}).get({frameLimit:0});
 const before=JSON.stringify(output),s=await summary(output),after=await summary(reloaded.cases[0].output);
 assert.deepEqual(s,after);assert.equal(JSON.stringify(output),before);assert.deepEqual(s.frames,[]);
 const nodeCount=output.mesh.nodes.length/3,info=output.result.snapshotInfo;
 assert.equal(info.bytes,nodeCount*info.count*8);assert.ok(info.bytes<=info.budgetBytes&&info.count>=2);
 cases.push(archive.cases[0]);
 records.push({kind,elapsedMs:Date.now()-start,inputSha256:sha(inputBytes),archiveSha256:sha(bytes),archiveBytes:Buffer.byteLength(bytes),nodeCount,summary:s,calculation:output.calculation});
}
const combined={version:1,cases};validateCaseArchive(combined);await publish('combined.json',JSON.stringify(combined,null,2)+'\n');
const report={schemaVersion:1,sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),helperSha256:sha(await readFile(new URL(import.meta.url))),node:process.version,scope:'Real synthetic headless process-isolated solves, saved archive reload and actual result-view adapter. Chrome and paired MCP are separate acceptance.',cleanup:'Both analyzeProject calls resolved after their owned process workers settled; no browser, server or probes created by this helper.',records};
await publish('headless-readbacks.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({directory:fileURLToPath(target),cases:records.map(r=>({kind:r.kind,nodeCount:r.nodeCount,snapshotStorage:r.summary.snapshotStorage}))}));
