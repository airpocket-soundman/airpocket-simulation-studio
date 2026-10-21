import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {installVisualExport,animationState} from '../src/visual-export.js';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';
import {fixedFrameSchedule,FIXED_FRAME_LIMITS,FIXED_FRAME_ANIMATIONS} from '../src/visual-export-fixed-frame.js';

const revision='sha256:'+'a'.repeat(64);

// Independent verification helpers. The STORE-ZIP writer under test is never asked to validate itself:
// these recompute CRC-32, walk central/local headers and decode PNG headers from the bytes.
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}return (crc^0xffffffff)>>>0;}
function parseStoreZip(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22,out=[];
 assert.equal(view.getUint32(end,true),0x06054b50,'EOCD record');
 const count=view.getUint16(end+10,true);assert.equal(view.getUint16(end+8,true),count);
 let pointer=view.getUint32(end+16,true),offset=0;
 for(let i=0;i<count;i++){
  assert.equal(view.getUint32(pointer,true),0x02014b50,'central header');
  assert.equal(view.getUint16(pointer+10,true),0,'central method is STORE');
  const nameLength=view.getUint16(pointer+28,true),name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(pointer+46,pointer+46+nameLength));
  const size=view.getUint32(pointer+24,true),crc=view.getUint32(pointer+16,true),local=view.getUint32(pointer+42,true);
  assert.equal(local,offset,'local headers are contiguous from the first entry');
  assert.equal(view.getUint32(local,true),0x04034b50,'local header');assert.equal(view.getUint16(local+8,true),0,'local method is STORE');
  assert.equal(view.getUint32(local+18,true),size);assert.equal(view.getUint32(local+22,true),size);assert.equal(view.getUint32(local+14,true),crc);
  assert.equal(view.getUint16(local+6,true),0x0800,'UTF-8 name flag without a data descriptor');
  const begin=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true),data=bytes.subarray(begin,begin+size);
  assert.equal(data.length,size);assert.equal(crc32(data),crc,'CRC-32 of '+name);
  out.push({name,size,data});offset=begin+size;pointer+=46+nameLength+view.getUint16(pointer+30,true)+view.getUint16(pointer+32,true);
 }
 assert.equal(offset+view.getUint32(end+12,true)+22,bytes.length);
 return out;
}
function chunk(type,data){const out=new Uint8Array(12+data.length),view=new DataView(out.buffer);view.setUint32(0,data.length);out.set(new TextEncoder().encode(type),4);out.set(data,8);view.setUint32(8+data.length,crc32(out.subarray(4,8+data.length)));return out;}
function concat(parts){const out=new Uint8Array(parts.reduce((total,part)=>total+part.length,0));let position=0;for(const part of parts){out.set(part,position);position+=part.length;}return out;}
/** Minimal structurally valid PNG (signature + IHDR + IDAT tag + IEND). The IDAT payload is a test tag, not rendered pixels. */
function pngBytes(width,height,payload){const ihdr=new Uint8Array(13),view=new DataView(ihdr.buffer);view.setUint32(0,width);view.setUint32(4,height);ihdr.set([8,2,0,0,0],8);return concat([Uint8Array.of(137,80,78,71,13,10,26,10),chunk('IHDR',ihdr),chunk('IDAT',new TextEncoder().encode('slice-frame:'+payload)),chunk('IEND',new Uint8Array())]);}
function pngInfo(bytes){assert.deepEqual(Array.from(bytes.subarray(0,8)),[137,80,78,71,13,10,26,10]);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);assert.equal(view.getUint32(8),13);assert.equal(new TextDecoder().decode(bytes.subarray(12,16)),'IHDR');assert.equal(crc32(bytes.subarray(12,29)),view.getUint32(29),'IHDR CRC');return {width:view.getUint32(16),height:view.getUint32(20)};}

// Reference geometry from a real, small structural solve (not a synthetic result):
// box 10 x 10 x 40 mm, E = 1 GPa, poisson 0.3, fixed +Z face at z = 0, 100 N in +Z on the z = 40 face,
// headless elastic wasm-pcg at mesh size 5 mm. Its volume mesh spans exactly 0..10 mm on X and Y and 0..40 mm on Z.
let reference;
const referenceSolve=()=>reference??=(async()=>{
 const {analyzeProject}=await import('../scripts/headless-analysis.mjs'),{createProjectFromBuiltin}=await import('../src/project-import.js');
 const faces=(project,z)=>project.meshes[0].faceIds.map((_,index)=>index).filter(index=>[2,5,8].every(offset=>Math.abs(project.meshes[0].positions[index*9+offset]-z)<1e-7));
 const input=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}});
 input.materialProperties={youngModulus:1e9,poissonRatio:.3};
 input.conditions=[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:faces(input,0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:faces(input,40)}]}];
 return {input,output:await analyzeProject(input,{size:5})};
})();
const axisRange=(output,axis)=>{const coordinates=output.mesh.nodes.filter((_,index)=>index%3===axis);return {min:Math.min(...coordinates),max:Math.max(...coordinates)};};

function fixture({output,axis='0',plane='4',clipEnabled=false,language='ja'}={}){
 const previous=globalThis.document,elements=new Map(),renders=[];
 function element(id){if(!elements.has(id))elements.set(id,{id,disabled:false,value:'',checked:false,textContent:'',after(){},click(){},dispatchEvent(){}});return elements.get(id);}
 for(const id of ['result-legend','name','section-summary','visual-export-status','visual-export-download','result-surface','result-surface-wire','view-png','animation-kind','animation-seconds','animation-preview','animation-save','animation-stop','cancel-run','clip-axis','deform-scale','clip-enabled','clip-position','agent-disconnect','acoustic-time-frame'])element(id);
 element('cancel-run').disabled=true;element('clip-axis').value=axis;element('deform-scale').value='2';element('clip-position').value=plane;element('clip-enabled').checked=clipEnabled;
 const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(){},fillText(){}}),toBlob(callback,type){callback(new Blob([pngBytes(this.width,this.height,element('clip-position').value)],{type}));}};
 globalThis.document={getElementById:id=>elements.get(id)??null,createElement:tag=>tag==='canvas'?canvas:{innerHTML:''},querySelectorAll:()=>[element('deform-scale'),element('clip-position'),element('animation-save'),element('agent-disconnect')]};
 const camera={position:{x:1,y:2,z:3,clone(){return {...this};},copy(){return this;},sub(){return this;},add(){return this;},applyAxisAngle(){return this;}},lookAt(){}},controls={target:{x:0,y:0,z:0,clone(){return {...this};},copy(){return this;}},enabled:true,enableDamping:true};
 // Records the section state the renderer actually sees for each captured frame.
 const renderer={domElement:{width:320,height:200},render(){renders.push({position:Number(element('clip-position').value),clipEnabled:element('clip-enabled').checked,axis:Number(element('clip-axis').value)});}};
 const api=installVisualExport({renderer,scene:{},camera,controls,getAnalysis:()=>output,redraw(){},language:()=>language,translate(){}});
 return {api,camera,controls,elements,renders,restore(){if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}};
}
const run=(f,extra={})=>f.api.render({format:'png-sequence',animation:'slice',frames:3,expectedResultRevision:revision,view:{result:{field:'displacement'}},...extra});
const zipOf=async blob=>parseStoreZip(new Uint8Array(await blob.arrayBuffer()));
const manifestOf=files=>JSON.parse(new TextDecoder().decode(files[0].data));

test('slice schedule spans the movable range end to end: positions 0/5/10 mm at phases 0/0.5/1',()=>{
 const schedule=fixedFrameSchedule({animation:'slice',frames:3,state:animationState,min:0,max:10});
 assert.deepEqual(schedule.map(step=>step.index),[0,1,2]);
 assert.deepEqual(schedule.map(step=>step.phase),[0,.5,1]);
 assert.deepEqual(schedule.map(step=>step.slicePosition),[0,5,10]);
 assert.deepEqual(fixedFrameSchedule({animation:'slice',frames:3,state:animationState,min:0,max:10}),schedule,'pure and deterministic');
 assert.equal(animationState('slice',.5,{min:2,max:6}).position,4);
 assert.equal(animationState('slice',0,{min:2,max:6}).position,2);
 assert.equal(animationState('slice',1,{min:2,max:6}).position,6);
});

test('the 0..10 mm slice range is the solved volume mesh axis in project mm, not a UI default',async()=>{
 const {input,output}=await referenceSolve();
 // createProjectFromBuiltin documents built-in dimensions and display coordinates as mm, so these node values are mm.
 assert.deepEqual(input.sourceModel,{kind:'box',bounds:[0,0,0,10,10,40]});
 assert.equal(output.result.kind,'elastic');
 assert.equal(output.calculation.options.method,'wasm-pcg');assert.equal(output.calculation.options.size,5);
 assert.equal(output.analysisAssessment.completePreflight,false,'preflight stays incomplete');
 assert.deepEqual(axisRange(output,0),{min:0,max:10});
 assert.deepEqual(axisRange(output,1),{min:0,max:10});
 assert.deepEqual(axisRange(output,2),{min:0,max:40});
 assert.ok(output.mesh.nodes.length/3>8);
});

test('3-frame slice export: manifest positions, renderer positions and independent ZIP/PNG checks agree',async()=>{
 const {output}=await referenceSolve(),f=fixture({output});
 try{
  const blob=await run(f);
  assert.equal(blob.type,'application/zip');
  const files=await zipOf(blob);
  assert.deepEqual(files.map(entry=>entry.name),['manifest.json','frame-0000.png','frame-0001.png','frame-0002.png']);
  const manifest=manifestOf(files);
  assert.equal(manifest.kind,'airpocket-fixed-frame-png-sequence');
  assert.equal(manifest.animation,'slice');assert.equal(manifest.frameCount,3);
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.resultRevision,revision);
  assert.deepEqual(manifest.resolution,{width:320,height:316});
  assert.equal(manifest.schedule.phase,'index/(frameCount-1)');assert.equal(manifest.schedule.timeBasis,'frame index');
  assert.equal(manifest.schedule.realtime,false);assert.equal(manifest.schedule.wallClockIndependent,true);
  assert.deepEqual(manifest.frames.map(frame=>frame.phase),[0,.5,1]);
  assert.deepEqual(manifest.frames.map(frame=>frame.slicePosition),[0,5,10]);
  // The renderer saw exactly the scheduled positions while the section was switched on for each frame.
  assert.deepEqual(f.renders.map(render=>render.position),[0,5,10]);
  assert.ok(f.renders.every(render=>render.clipEnabled&&render.axis===0));
  const digests=[];
  manifest.frames.forEach((frame,index)=>{
   const png=files[index+1];
   assert.equal(frame.file,png.name);assert.equal(frame.index,index);assert.equal(frame.bytes,png.size);
   assert.equal(frame.width,320);assert.equal(frame.height,316);assert.equal(frame.camera,undefined);
   assert.equal(frame.resultRevision,revision);
   assert.equal(frame.sha256,'sha256:'+createHash('sha256').update(png.data).digest('hex'));
   assert.deepEqual(pngInfo(png.data),{width:320,height:316});
   digests.push(frame.sha256);
  });
  // Distinct ZIP payloads only prove the pipeline carried per-frame state; they are not evidence of section physics accuracy.
  assert.equal(new Set(digests).size,3);assert.equal(new Set(files.slice(1).map(entry=>new TextDecoder().decode(entry.data))).size,3);
  // Restoration: section toggle/position and camera/controls return to the values held before the export.
  assert.equal(f.elements.get('clip-position').value,'4');assert.equal(f.elements.get('clip-enabled').checked,false);assert.equal(f.elements.get('clip-axis').value,'0');
  assert.equal(f.controls.enabled,true);assert.equal(f.controls.enableDamping,true);assert.equal(f.api.isActive(),false);
  assert.equal(f.elements.get('animation-save').disabled,false);
  const first=Buffer.from(await blob.arrayBuffer());
  assert.equal(Buffer.compare(first,Buffer.from(await (await run(f)).arrayBuffer())),0,'same frozen result and locale is byte-reproducible');
  const other=fixture({output,language:'en'});
  try{assert.equal(Buffer.compare(first,Buffer.from(await (await run(other)).arrayBuffer())),0,'the harness double draws no locale text; real canvases can differ by locale/caption bytes');}
  finally{other.restore();}
 }finally{f.restore();}
});

test('the exported slice range follows the selected section axis',async()=>{
 const {output}=await referenceSolve(),f=fixture({output,axis:'2'});
 try{
  const manifest=manifestOf(await zipOf(await run(f)));
  assert.deepEqual(manifest.frames.map(frame=>frame.slicePosition),[0,20,40]);
  assert.deepEqual(f.renders.map(render=>render.position),[0,20,40]);
  assert.ok(f.renders.every(render=>render.axis===2&&render.clipEnabled));
  assert.equal(f.elements.get('clip-position').value,'4');
 }finally{f.restore();}
});

test('job layer: slice archive pages, manifest and the no-seconds rule',async()=>{
 const {output}=await referenceSolve(),f=fixture({output});
 try{
  const jobs=createVisualExportJobs({render:args=>f.api.render(args)}),request={requestId:'slice-reference',expectedResultRevision:revision,format:'png-sequence',animation:'slice',frames:3,view:{result:{field:'displacement'}}};
  await assert.rejects(jobs.start({...request,requestId:'with-seconds',seconds:5}),/seconds/);
  await assert.rejects(jobs.start({...request,requestId:'one-frame',frames:1}),/frames/);
  const job=await jobs.start(request);let state;
  for(;;){state=jobs.status(job);if(state.state!=='running')break;await new Promise(resolve=>setTimeout(resolve,5));}
  assert.equal(state.state,'completed',state.error);
  const artifact=state.artifact;
  assert.equal(artifact.mimeType,'application/zip');assert.match(artifact.name,/\.zip$/);
  assert.equal(artifact.manifest.frameCount,3);assert.equal(artifact.manifest.container,'zip');assert.equal(artifact.manifest.compression,'store');
  assert.equal(artifact.manifest.time.animation,'slice');assert.equal(artifact.manifest.time.frameSelection,'deterministic schedule');assert.equal(artifact.manifest.time.realtime,false);
  assert.deepEqual(artifact.manifest.resolution,{width:320,height:316});
  const pages=[];for(let offset=0;;){const page=jobs.artifact({jobId:job.jobId,offset,length:65536});pages.push(Buffer.from(page.data,'base64'));if(page.nextOffset===null)break;offset=page.nextOffset;}
  const bytes=Buffer.concat(pages);
  assert.equal(artifact.sha256,'sha256:'+createHash('sha256').update(bytes).digest('hex'));
  const files=parseStoreZip(new Uint8Array(bytes)),inner=files.find(entry=>entry.name==='manifest.json').data;
  assert.equal(artifact.manifest.manifestEntry.bytes,inner.length);
  assert.equal(artifact.manifest.manifestEntry.sha256,'sha256:'+createHash('sha256').update(inner).digest('hex'));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(inner)).frames.map(frame=>frame.slicePosition),[0,5,10]);
  const withoutMesh=fixture({output:{result:{kind:'elastic'}}});
  try{
   const refused=createVisualExportJobs({render:args=>withoutMesh.api.render(args)}),failed=await refused.start({...request,requestId:'no-mesh'});let refusal;
   for(;;){refusal=refused.status(failed);if(refusal.state!=='running')break;await new Promise(resolve=>setTimeout(resolve,5));}
   assert.equal(refusal.state,'failed');assert.match(refusal.error,/volume mesh/);assert.throws(()=>refused.artifact(failed),/unavailable/);
   assert.equal(withoutMesh.renders.length,0);
  }finally{withoutMesh.restore();}
 }finally{f.restore();}
});

test('cancelling a slice export after the first frame restores the section and refuses the artifact',async()=>{
 const {output}=await referenceSolve(),f=fixture({output});
 try{
  const jobs=createVisualExportJobs({render:args=>f.api.render(args)}),job=await jobs.start({requestId:'slice-cancel',expectedResultRevision:revision,format:'png-sequence',animation:'slice',frames:3,view:{result:{field:'displacement'}}});
  assert.equal(jobs.cancel(job).state,'cancelled');
  await jobs.waitForSettled(job);
  assert.equal(jobs.status(job).state,'cancelled');assert.throws(()=>jobs.artifact(job),/unavailable/);
  assert.equal(f.renders.length,1,'the frame in flight is captured but no partial ZIP is kept');
  assert.equal(f.elements.get('clip-position').value,'4');assert.equal(f.elements.get('clip-enabled').checked,false);
  assert.equal(f.controls.enabled,true);assert.equal(f.api.isActive(),false);assert.equal(f.elements.get('animation-save').disabled,false);
 }finally{f.restore();}
});

test('fixed-frame caps and the animation list are unchanged by the slice reference',()=>{
 assert.deepEqual(FIXED_FRAME_LIMITS,{minFrames:2,maxFrames:120,defaultFrames:24,maxFrameBytes:4*1024*1024,maxTotalBytes:24*1024*1024});
 assert.deepEqual([...FIXED_FRAME_ANIMATIONS],['orbit','deformation','time','slice']);
});
