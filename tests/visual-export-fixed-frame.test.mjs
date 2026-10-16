import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {installVisualExport,animationState} from '../src/visual-export.js';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';
import {fixedFrameSchedule,buildStoreZip,orbitCameraPosition,FIXED_FRAME_LIMITS} from '../src/visual-export-fixed-frame.js';

const revision='sha256:'+'b'.repeat(64);
class Vector{constructor(x=1,y=2,z=3){Object.assign(this,{x,y,z});}clone(){return new Vector(this.x,this.y,this.z);}copy(v){Object.assign(this,{x:v.x,y:v.y,z:v.z});return this;}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
 applyAxisAngle(axis,angle){const c=Math.cos(angle),s=Math.sin(angle),x=this.x*c+this.z*s,z=-this.x*s+this.z*c;this.x=x;this.z=z;return this;}}
// Independent tiny ZIP reader (STORE only) so the writer is not tested against itself.
function crc(b){let c=0xffffffff;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;}
function parseZip(bytes){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22;assert.equal(v.getUint32(end,true),0x06054b50);const n=v.getUint16(end+10,true),out=[];let p=v.getUint32(end+16,true);
 for(let i=0;i<n;i++){assert.equal(v.getUint32(p,true),0x02014b50);assert.equal(v.getUint16(p+10,true),0);const name=new TextDecoder().decode(bytes.subarray(p+46,p+46+v.getUint16(p+28,true))),size=v.getUint32(p+24,true),lo=v.getUint32(p+42,true);
  assert.equal(v.getUint32(lo,true),0x04034b50);assert.equal(v.getUint16(lo+8,true),0);assert.equal(v.getUint32(lo+18,true),size);const begin=lo+30+v.getUint16(lo+26,true)+v.getUint16(lo+28,true),data=bytes.subarray(begin,begin+size);
  assert.equal(crc(data),v.getUint32(p+16,true));assert.equal(v.getUint32(lo+14,true),v.getUint32(p+16,true));out.push({name,data});p+=46+v.getUint16(p+28,true)+v.getUint16(p+30,true)+v.getUint16(p+32,true);}
 return out;}

function fixture({kind='elastic',snapshots=0,pngBytes,getTimeView,restoreTimeView}={}){
 const previous=globalThis.document,elements=new Map();let renders=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{id,disabled:false,value:'',checked:false,textContent:'',after(){},click(){},dispatchEvent(){}});return elements.get(id);};
 for(const id of ['result-legend','name','section-summary','visual-export-status','visual-export-download','result-surface','result-surface-wire','view-png','animation-kind','animation-seconds','animation-preview','animation-save','animation-stop','cancel-run','clip-axis','deform-scale','clip-enabled','clip-position','agent-disconnect','acoustic-time-frame'])element(id);
 element('cancel-run').disabled=true;element('clip-axis').value='0';element('deform-scale').value='2';element('clip-position').value='4';element('acoustic-time-frame').value='0';
 let last='';const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(){},fillText(){}}),toBlob(cb,type){cb(new Blob([pngBytes?pngBytes(last):'frame:'+last],{type}));}};
 globalThis.document={getElementById:id=>elements.get(id)??null,createElement:tag=>tag==='canvas'?canvas:{innerHTML:''},querySelectorAll:()=>[element('deform-scale'),element('clip-position'),element('animation-save'),element('agent-disconnect')]};
 const camera={position:new Vector(),lookAt(){}},controls={target:new Vector(0,0,0),enabled:true,enableDamping:true};
 const output={mesh:{nodes:[0,0,0,1,1,1]},result:{kind,...(kind==='thermal'?{transient:true}:{}),snapshots:Array.from({length:snapshots},(_,i)=>({time:i*0.5,...(kind==='thermal'?{temperature:[20+i,30+i]}:{})}))}};
 const api=installVisualExport({renderer:{domElement:{width:320,height:200},render(){renders++;last=[camera.position.x,camera.position.z,element('deform-scale').value,element('acoustic-time-frame').value,element('clip-position').value].map(v=>Number(v).toFixed(6)).join(',');}},scene:{},camera,controls,getAnalysis:()=>output,redraw(){},language:()=> 'en',translate(){},getTimeView,restoreTimeView});
 return {api,camera,controls,elements,get renders(){return renders;},output,restore(){if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}};
}
const run=(f,extra={})=>f.api.render({format:'png-sequence',animation:'orbit',frames:4,expectedResultRevision:revision,view:{result:{field:'temperature',camera:{position:[1,2,3]}}},...extra});
const zipOf=async blob=>parseZip(new Uint8Array(await blob.arrayBuffer()));

test('schedule is pure, deterministic and cyclic vs ranged by animation',()=>{
 const a=fixedFrameSchedule({animation:'orbit',frames:4,state:animationState}),b=fixedFrameSchedule({animation:'orbit',frames:4,state:animationState});
 assert.deepEqual(a,b);assert.deepEqual(a.map(s=>s.phase),[0,.25,.5,.75]);assert.equal(a[1].angleRadians,Math.PI/2);
 const t=fixedFrameSchedule({animation:'time',frames:3,state:animationState,snapshotTimes:[0,.5,1,1.5]});assert.deepEqual(t.map(s=>s.snapshotIndex),[0,2,3]);assert.deepEqual(t.map(s=>s.physicalTimeSeconds),[0,1,1.5]);
 const sl=fixedFrameSchedule({animation:'slice',frames:3,state:animationState,min:2,max:4});assert.deepEqual(sl.map(s=>s.slicePosition),[2,3,4]);
 const d=fixedFrameSchedule({animation:'deformation',frames:2,state:animationState,scale:3});assert.deepEqual(d.map(s=>s.deformScale),[0,3]);
 assert.throws(()=>fixedFrameSchedule({animation:'time',frames:5,state:animationState,snapshotTimes:[0,1]}),/exceed/);
 assert.throws(()=>fixedFrameSchedule({animation:'orbit',frames:1,state:animationState}),/frames/);
 assert.throws(()=>fixedFrameSchedule({animation:'orbit',frames:FIXED_FRAME_LIMITS.maxFrames+1,state:animationState}),/frames/);
 assert.throws(()=>fixedFrameSchedule({animation:'spin',frames:4,state:animationState}),/animation/);
});

test('ZIP writer emits STORE entries with correct headers and CRC, and is byte-reproducible',()=>{
 const entries=[{name:'a.txt',bytes:new TextEncoder().encode('hello')},{name:'dir/b.bin',bytes:Uint8Array.of(0,1,2,255)}],zip=buildStoreZip(entries);
 assert.deepEqual(buildStoreZip(entries),zip);const parsed=parseZip(zip);assert.deepEqual(parsed.map(e=>e.name),['a.txt','dir/b.bin']);assert.deepEqual(Array.from(parsed[1].data),[0,1,2,255]);assert.equal(crc(parsed[0].data),0x3610a686);
 assert.throws(()=>buildStoreZip([{name:'../x',bytes:new Uint8Array()}]),/name/);assert.throws(()=>buildStoreZip([entries[0],entries[0]]),/duplicate/i);
});

test('png-sequence renders per-index states, hashes match, view restored, no clock use',async()=>{
 const f=fixture(),saved=f.camera.position.clone(),realNow=performance.now;performance.now=()=>{throw Error('wall clock used');};
 try{
  const progress=[],blob=await run(f,{onProgress:p=>progress.push(p.fraction)});
  assert.equal(blob.type,'application/zip');const files=await zipOf(blob);assert.deepEqual(files.map(e=>e.name),['manifest.json','frame-0000.png','frame-0001.png','frame-0002.png','frame-0003.png']);
  const manifest=JSON.parse(new TextDecoder().decode(files[0].data));assert.equal(manifest.frameCount,4);assert.equal(manifest.resultRevision,revision);assert.deepEqual(manifest.resolution,{width:320,height:316});assert.equal(manifest.view.field,'temperature');assert.equal(manifest.schedule.realtime,false);
  manifest.frames.forEach((fr,i)=>{const png=files[i+1];assert.equal(fr.file,png.name);assert.equal(fr.index,i);assert.equal(fr.phase,i/4);assert.equal(fr.resultRevision,revision);assert.equal(fr.sha256,'sha256:'+createHash('sha256').update(png.data).digest('hex'));assert.equal(fr.bytes,png.data.length);});
  const texts=files.slice(1).map(e=>new TextDecoder().decode(e.data));assert.equal(new Set(texts).size,4);
  const again=await zipOf(await run(f));assert.deepEqual(again.map(e=>Array.from(e.data).join()),files.map(e=>Array.from(e.data).join()));
  assert.deepEqual(f.camera.position,saved);assert.equal(f.controls.enabled,true);assert.equal(f.controls.enableDamping,true);assert.equal(f.api.isActive(),false);assert.equal(f.elements.get('deform-scale').value,'2');assert.equal(f.elements.get('deform-scale').disabled,false);assert.equal(progress.at(-1),1);
 }finally{performance.now=realNow;f.restore();}
});

test('time animation uses stored snapshots and records physical time; too many frames is refused',async()=>{
 const f=fixture({kind:'acousticTransient',snapshots:4});try{
  const files=await zipOf(await run(f,{animation:'time',frames:3})),manifest=JSON.parse(new TextDecoder().decode(files[0].data));
  assert.deepEqual(manifest.frames.map(x=>x.snapshotIndex),[0,2,3]);assert.deepEqual(manifest.frames.map(x=>x.physicalTimeSeconds),[0,1,1.5]);assert.equal(f.elements.get('acoustic-time-frame').value,'0');
  await assert.rejects(run(f,{animation:'time',frames:5}),/exceed/);assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);
 }finally{f.restore();}
});

test('cancellation mid-run restores controls and refuses the artifact',async()=>{
 const f=fixture(),saved=f.camera.position.clone();try{
  const controller=new AbortController();let frames=0;
  const promise=run(f,{frames:10,signal:controller.signal,onProgress:()=>{if(++frames===3)controller.abort();}});
  assert.equal(f.api.isActive(),true);assert.equal(f.controls.enabled,false);
  await assert.rejects(promise,/cancelled/);assert.deepEqual(f.camera.position,saved);assert.equal(f.controls.enabled,true);assert.equal(f.api.isActive(),false);assert.ok(f.renders<10);assert.equal(f.elements.get('animation-save').disabled,false);
 }finally{f.restore();}
});

test('frame and byte caps give explicit refusals and still restore state',async()=>{
 const f=fixture();try{
  for(const frames of [1,FIXED_FRAME_LIMITS.maxFrames+1,2.5])await assert.rejects(run(f,{frames}),/frames/);
  assert.equal(f.renders,0);
 }finally{f.restore();}
 const big=fixture({pngBytes:()=>new Uint8Array(FIXED_FRAME_LIMITS.maxFrameBytes+1)});try{await assert.rejects(run(big),/frame cap/);assert.equal(big.controls.enabled,true);assert.equal(big.api.isActive(),false);}finally{big.restore();}
 const total=fixture({pngBytes:()=>new Uint8Array(FIXED_FRAME_LIMITS.maxFrameBytes)});try{await assert.rejects(run(total,{frames:8}),/total cap/);assert.equal(total.api.isActive(),false);}finally{total.restore();}
});

test('capabilities report png-sequence additively and keep mp4/gif unsupported',()=>{
 const f=fixture();try{const c=f.api.capabilities({mediaRecorder:undefined});
  assert.equal(c['png-sequence'],true);const s=c.formats['png-sequence'];assert.equal(s.supported,true);assert.equal(s.maxFrames,FIXED_FRAME_LIMITS.maxFrames);assert.equal(s.container,'zip');assert.equal(s.compression,'store');assert.equal(c.mp4,false);assert.equal(c.gif,false);assert.equal(c.formats.mp4.supported,false);assert.equal(c.formats.gif.supported,false);
 }finally{f.restore();}
});

test('job layer: png-sequence request validation, ZIP artifact, bounded manifest and hash',async()=>{
 const f=fixture();try{
  const api=createVisualExportJobs({render:args=>f.api.render(args)}),args={requestId:'seq',expectedResultRevision:revision,format:'png-sequence',animation:'orbit',frames:4,view:{result:{field:'temperature'}}};
  for(const patch of [{frames:1},{frames:121},{seconds:5},{format:'png',frames:4}])await assert.rejects(api.start({...args,requestId:'bad',...patch}));
  const job=await api.start(args);let state;for(;;){state=api.status(job);if(state.state!=='running')break;await new Promise(r=>setTimeout(r,5));}
  assert.equal(state.state,'completed',state.error);const a=state.artifact;assert.equal(a.mimeType,'application/zip');assert.match(a.name,/\.zip$/);assert.equal(a.manifest.format,'png-sequence');assert.equal(a.manifest.frameCount,4);assert.ok(JSON.stringify(a.manifest).length<=4096);assert.equal(a.manifest.manifestEntry.name,'manifest.json');
  const page=api.artifact({...job,length:65536}),bytes=Buffer.from(page.data,'base64');assert.equal(page.nextOffset,null);assert.equal(a.sha256,'sha256:'+createHash('sha256').update(bytes).digest('hex'));
  const inner=parseZip(new Uint8Array(bytes))[0];assert.equal(a.manifest.manifestEntry.sha256,'sha256:'+createHash('sha256').update(inner.data).digest('hex'));
  assert.equal((await api.start(args)).jobId,job.jobId);
 }finally{f.restore();}
});

test('job layer refuses an archive that is not a valid frame sequence',async()=>{
 const bad=createVisualExportJobs({render:()=>new Blob([buildStoreZip([{name:'x.txt',bytes:Uint8Array.of(1)}])],{type:'application/zip'})}),job=await bad.start({requestId:'z',expectedResultRevision:revision,format:'png-sequence',view:{}});
 let s;for(;;){s=bad.status(job);if(s.state!=='running')break;await new Promise(r=>setTimeout(r,5));}assert.equal(s.state,'failed');assert.throws(()=>bad.artifact(job),/unavailable/);
});

test('orbit manifest camera numbers are deterministic and rounded: identical manifest bytes across exports',async()=>{
 const f=fixture({kind:'elastic'});try{
  f.camera.position=new Vector(-36,10,0);f.controls.target=new Vector(0.1,0.2,0.3);
  const manifestBytes=async()=>(await zipOf(await run(f,{frames:8}))).find(e=>e.name==='manifest.json').data;
  const a=await manifestBytes();f.camera.position=new Vector(-36,10,0);const b=await manifestBytes();
  assert.equal(Buffer.compare(Buffer.from(a),Buffer.from(b)),0);
  const manifest=JSON.parse(new TextDecoder().decode(a));
  assert.deepEqual(manifest.frames[0].camera.position,[-36,10,0]);
  for(const frame of manifest.frames)for(const v of frame.camera.position)assert.equal(v,Math.round(v*1e9)/1e9);
  // The pure formula equals the rotation the live camera applies (frames themselves are unchanged).
 assert.deepEqual(orbitCameraPosition([-36,10,0],[0.1,0.2,0.3],Math.PI/2),[-0.2,10.2,36.4].map((v,k)=>k===1?10:v));
 }finally{f.restore();}
});

test('preflight refuses time on a non-transient result and deformation on non-structural, before any job starts',()=>{
 const f=fixture({kind:'elastic'});try{
  assert.throws(()=>f.api.preflight({animation:'time'}),/transient acoustic/);
  assert.doesNotThrow(()=>f.api.preflight({animation:'deformation'}));assert.doesNotThrow(()=>f.api.preflight({animation:'orbit'}));
 }finally{f.restore();}
});

test('physicalRevision: ZIP embeds it instead of the wall-clock-sensitive resultRevision; schemaVersion 2',async()=>{
 const f=fixture(),physical='sha256:'+'c'.repeat(64);try{
  const files=await zipOf(await run(f,{physicalRevision:physical})),manifest=JSON.parse(new TextDecoder().decode(files[0].data));
  assert.equal(manifest.schemaVersion,2);assert.equal(manifest.physicalRevision,physical);assert.equal(manifest.resultRevision,undefined);
  for(const fr of manifest.frames){assert.equal(fr.physicalRevision,physical);assert.equal(fr.resultRevision,undefined);}
  assert.ok(!new TextDecoder().decode(files[0].data).includes(revision));
 }finally{f.restore();}
});

test('two real solves differing only in solveMs yield different resultRevision, same physicalRevision and byte-identical ZIPs',async()=>{
 const {analyzeProject}=await import('../scripts/headless-analysis.mjs'),{createProjectFromBuiltin}=await import('../src/project-import.js'),{getProjectRevision,getPhysicalRevision}=await import('../src/project-revision.js');
 const faces=(p,z)=>p.meshes[0].faceIds.map((_,i)=>i).filter(i=>[2,5,8].every(k=>Math.abs(p.meshes[0].positions[i*9+k]-z)<1e-7));
 const make=()=>{const p=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}});p.materialProperties={youngModulus:1e9,poissonRatio:.3};p.conditions=[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:faces(p,0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:faces(p,40)}]}];return p;};
 const a=JSON.parse(JSON.stringify(await analyzeProject(make(),{size:5}))),b=JSON.parse(JSON.stringify(await analyzeProject(make(),{size:5})));
 b.result.performance.solveMs=a.result.performance.solveMs+123.456;
 const [ra,rb,pa,pb]=await Promise.all([getProjectRevision(a),getProjectRevision(b),getPhysicalRevision(a),getPhysicalRevision(b)]);
 assert.notEqual(ra,rb);assert.equal(pa,pb);
 const withoutPerf=JSON.parse(JSON.stringify(a));delete withoutPerf.result.performance;assert.equal(pa,await getProjectRevision(withoutPerf));
 const f=fixture();try{
  const zip=async(result,physicalRevision)=>Buffer.from(await (await run(f,{expectedResultRevision:result,physicalRevision})).arrayBuffer());
  const x=await zip(ra,pa),y=await zip(rb,pb);assert.equal(Buffer.compare(x,y),0);
  // Legacy path (no physicalRevision) still embeds resultRevision, so differing solves differ there.
  assert.notEqual(Buffer.compare(await zip(ra),await zip(rb)),0);
 }finally{f.restore();}
});

test('job layer carries physicalRevision from prepare into the ZIP and the outer manifest; resultRevision keeps its meaning',async()=>{
 const f=fixture(),physical='sha256:'+'d'.repeat(64);try{
  const api=createVisualExportJobs({prepare:async r=>({resultRevision:r.expectedResultRevision,physicalRevision:physical,view:r.view}),render:args=>f.api.render(args)}),args={requestId:'phys',expectedResultRevision:revision,format:'png-sequence',animation:'orbit',frames:4,view:{result:{field:'temperature'}}};
  const job=await api.start(args);let state;for(;;){state=api.status(job);if(state.state!=='running')break;await new Promise(r=>setTimeout(r,5));}
  assert.equal(state.state,'completed',state.error);assert.equal(state.resultRevision,revision);assert.equal(state.artifact.manifest.resultRevision,revision);assert.equal(state.artifact.manifest.physicalRevision,physical);
  const inner=JSON.parse(new TextDecoder().decode(parseZip(new Uint8Array(Buffer.from(api.artifact({...job,length:65536}).data,'base64')))[0].data));assert.equal(inner.physicalRevision,physical);
 }finally{f.restore();}
});


test('thermal PNG sequence uses only stored temperatures, exact times, reproducible frames and truthful job metadata',async()=>{
 const f=fixture({kind:'thermal',snapshots:4});try{
  f.output.result.snapshots.forEach((frame,i)=>{frame.time=[0,.2,2,7][i];});
  const files=await zipOf(await run(f,{animation:'time',frames:3})),manifest=JSON.parse(new TextDecoder().decode(files[0].data));
  assert.deepEqual(manifest.frames.map(x=>x.snapshotIndex),[0,2,3]);assert.deepEqual(manifest.frames.map(x=>x.physicalTimeSeconds),[0,2,7]);assert.equal(manifest.schedule.timeBasis,'stored thermal temperature frames');assert.equal(manifest.schedule.field,'temperature');assert.equal(manifest.schedule.resultKind,'thermal');
  assert.equal(new Set(files.slice(1).map(x=>new TextDecoder().decode(x.data))).size,3);for(const [i,fr]of manifest.frames.entries())assert.equal(fr.sha256,'sha256:'+createHash('sha256').update(files[i+1].data).digest('hex'));
  assert.deepEqual(await zipOf(await run(f,{animation:'time',frames:3})),files);
  const caps=f.api.capabilities();assert.deepEqual(caps.formats['png-sequence'].timeAnimationResultKinds,['acousticTransient','thermal']);assert.deepEqual(caps.timeAnimationResultKinds,['acousticTransient']);
  const jobs=createVisualExportJobs({render:args=>f.api.render(args)}),job=await jobs.start({requestId:'thermal',expectedResultRevision:revision,format:'png-sequence',animation:'time',frames:3,view:{result:{field:'temperature'}}});let state;for(let i=0;i<100;i++){state=jobs.status({jobId:job.jobId});if(state.state==='completed'||state.state==='failed')break;await new Promise(resolve=>setTimeout(resolve,5));}
  assert.equal(state.state,'completed',state.error);assert.equal(state.artifact.manifest.time.frameSelection,'stored-thermal-temperature-frames-only');assert.equal(state.artifact.manifest.time.field,'temperature');
 }finally{f.restore();}
});

test('thermal PNG sequence refuses flux, absent frames, invalid time/temperature and still refuses WebM',async()=>{
 const f=fixture({kind:'thermal',snapshots:3});try{
  await assert.rejects(run(f,{animation:'time',frames:2,view:{result:{field:'heatFlux'}}}),/temperature/);assert.equal(f.renders,0);
  f.output.result.transient=false;await assert.rejects(run(f,{animation:'time',frames:2}),/stored/);f.output.result.transient=true;
  f.output.result.snapshots[1].time=0;await assert.rejects(run(f,{animation:'time',frames:2}),/increasing/);f.output.result.snapshots[1].time=.5;
  f.output.result.snapshots[1].temperature=[1];await assert.rejects(run(f,{animation:'time',frames:2}),/temperatures/);
  await assert.rejects(f.api.render({format:'webm',animation:'time',seconds:1}),/not supported for thermal/);assert.equal(f.renders,0);
 }finally{f.restore();}
});

test('thermal sequence restores exact interpolated time through hooks after completion and cancellation',async()=>{
 const exact={frameIndex:1,timeSeconds:.67890123456789},restored=[];const f=fixture({kind:'thermal',snapshots:4,getTimeView:()=>structuredClone(exact),restoreTimeView:state=>restored.push(state)});try{
  await run(f,{animation:'time',frames:3});assert.deepEqual(restored,[exact]);
  const controller=new AbortController();await assert.rejects(run(f,{animation:'time',frames:3,signal:controller.signal,onProgress:()=>controller.abort()}),/cancelled/);assert.deepEqual(restored,[exact,exact]);assert.equal(f.api.isActive(),false);
 }finally{f.restore();}
});
