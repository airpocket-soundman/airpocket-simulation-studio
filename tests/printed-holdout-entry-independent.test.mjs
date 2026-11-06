import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,realpath,readdir,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,dirname,basename} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {getCapabilities} from '../src/capabilities.js';
const cli=fileURLToPath(new URL('../scripts/compare-printed-holdout.mjs',import.meta.url)),mcp=fileURLToPath(new URL('../scripts/studio-mcp.mjs',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const options={model:'linear-elastic',maxStrain:.01,minPoints:3,maxRelativeStandardError:.1};
const specimen={id:'train',dimensions:[1,1,10],gaugeLength:10,buildDirection:[0,0,1],batch:'synthetic-only',temperature:20,speed:1,displacementKind:'gauge'};
const header={schemaVersion:1,id:'独立-training',revision:'1',provenance:'synthetic',units:{length:'mm',force:'N',time:'s',temperature:'degC',speed:'mm/s'},instrument:{id:'invented-no-device',hardwareRevision:'1',softwareRevision:'1'},calibration:{status:'unverified',forceEvidence:null,displacementEvidence:null,dimensionEvidence:null}};
async function fixture(t){
 const parent=await realpath(tmpdir()),dir=await mkdtemp(join(parent,'holdout-independent-'));assert.equal(dirname(dir),parent);assert(basename(dir).startsWith('holdout-independent-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 // Training noise is orthogonal to strain: Σ i[-2,1,0,0,0]_i = 0.
 const training={...header,specimens:[{...specimen,samples:[1,2,3,4,5].map((i,j)=>[i,(7e8*i/1000+100*[-2,1,0,0,0][j])*1e-6,i/100])}]};
 const validation={...header,id:'独立-validation',units:{...header.units,length:'m',force:'kN',speed:'m/s'},specimens:[{...specimen,id:'validation',dimensions:[.001,.001,.01],gaugeLength:.01,speed:.001,samples:[.0015,.0035,.0045].map((e,i)=>[10+i,(7e8*e+[300,-100,50][i])*1e-9,e*.01])}]};
 const p={dir,request:join(dir,'request.json'),output:join(dir,'output.json'),training:join(dir,'training.json'),validation:join(dir,'validation.json'),trainingObject:training,validationObject:validation};
 async function save(a=JSON.stringify(training),b=JSON.stringify(validation)){
  await writeFile(p.training,a);await writeFile(p.validation,b);p.config={schemaVersion:1,training:{path:p.training,expectedSHA256:hash(a)},validation:{path:p.validation,expectedSHA256:hash(b)},options,specimenPairs:[{trainingSpecimenId:'train',validationSpecimenId:'validation'}]};await writeFile(p.request,JSON.stringify(p.config));
 }
 p.save=save;await save();return p;
}
function invoke(p){const r=spawnSync(process.execPath,[cli,'--request',p.request,'--output',p.output],{encoding:'utf8',timeout:30000,maxBuffer:65536});assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.stderr,'');return {code:r.status,summary:JSON.parse(r.stdout)};}
async function artifact(p,r){const b=await readFile(p.output);assert.equal(b.length,r.summary.outputBytes);assert.equal(hash(b),r.summary.outputSha256);return JSON.parse(b);}
const close=(a,b,t=1e-5)=>assert(Math.abs(a-b)<t,`${a} vs ${b}`);

test('independent m/kN holdout oracle preserves training fit under changed validation and exact UTF8 identities',async t=>{
 const p=await fixture(t),before=await Promise.all([p.training,p.validation,p.request].map(f=>readFile(f))),r=invoke(p),a=await artifact(p,r),pair=a.result.pairs[0];assert.equal(r.code,0);
 close(pair.parameters.youngsModulusPa.value,7e8);close(pair.parameters.youngsModulusPa.standardError,Math.sqrt((50000/4)/.000055));
 for(const [i,residual]of [-300,100,-50].entries())close(pair.samples[i].residualPa,residual);
 close(pair.metrics.biasPa,-250/3);close(pair.metrics.meanAbsoluteErrorPa,150);close(pair.metrics.rootMeanSquareErrorPa,Math.sqrt(102500/3));close(pair.metrics.maximumAbsoluteErrorPa,300);
 for(const [i,k]of ['training','validation','request'].entries()){assert.equal(a.inputs[k].sha256,hash(before[i]));assert.equal(a.inputs[k].bytes,before[i].length);assert.deepEqual(await readFile(p[k]),before[i]);}
 assert.equal(a.calibrated,false);assert.equal(a.accuracyVerified,false);assert.equal(a.physicalIndependenceVerified,false);assert.equal(a.result.independence,'declared-only');
 p.validationObject.specimens[0].samples.forEach(row=>row[1]*=7);await p.save();p.output=join(p.dir,'changed-validation.json');const changed=await artifact(p,invoke(p));assert.deepEqual(changed.result.pairs[0].parameters,pair.parameters);assert(changed.result.pairs[0].metrics.maximumAbsoluteErrorPa>1e6);
});

test('both exact 2MB dataset limits accept, then one extra raw byte refuses without model values or temporary artifacts',async t=>{
 const p=await fixture(t),pad=o=>{const s=JSON.stringify(o);return s+' '.repeat(2000000-Buffer.byteLength(s));};const a=pad(p.trainingObject),b=pad(p.validationObject);await p.save(a,b);let r=invoke(p),report=await artifact(p,r);assert.equal(r.code,0);assert.equal(report.inputs.training.bytes,2000000);assert.equal(report.inputs.validation.bytes,2000000);
 await p.save(a+' ',b);p.output=join(p.dir,'oversized.json');r=invoke(p);report=await artifact(p,r);assert.equal(r.code,2);assert.equal(report.result,null);assert.equal(report.refusal.stage,'read');assert.equal(report.refusal.code,'PRINTED_IDENTIFICATION_BYTE_LIMIT');assert.equal(report.inputs.training,null);assert.deepEqual((await readdir(p.dir)).filter(x=>x.endsWith('.tmp')),[]);
});

test('link components and existing output directories refuse without changing either input or preexisting destination',async t=>{
 const p=await fixture(t),before=await readFile(p.training),folder=join(p.dir,'destination');await mkdir(folder);p.output=folder;const r=invoke(p);assert.equal(r.code,1);assert.equal(r.summary.code,'PRINTED_IDENTIFICATION_OUTPUT_EXISTS');assert.deepEqual(await readFile(p.training),before);assert.deepEqual(await readdir(folder),[]);
 const real=join(p.dir,'real'),alias=join(p.dir,'alias');await mkdir(real);await writeFile(join(real,'training.json'),before);await symlink(real,alias,process.platform==='win32'?'junction':'dir');p.config.training.path=join(alias,'training.json');await writeFile(p.request,JSON.stringify(p.config));p.output=join(p.dir,'never.json');assert.equal(invoke(p).summary.code,'PRINTED_IDENTIFICATION_SYMLINK');await assert.rejects(readFile(p.output),e=>e.code==='ENOENT');
});

test('formal stdio advertises Node-only non-idempotent capability and returns a bounded SHA refusal artifact',async t=>{
 assert.equal(getCapabilities({target:'browser'}).printedHoldout.available,false);
 const p=await fixture(t);p.config.training.expectedSHA256='0'.repeat(64);await writeFile(p.request,JSON.stringify(p.config));
 const messages=[{id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'independent-holdout',version:'1'}}},{method:'notifications/initialized'},{id:2,method:'tools/list',params:{}},{id:3,method:'tools/call',params:{name:'studio_capabilities',arguments:{}}},{id:4,method:'tools/call',params:{name:'studio_compare_printed_holdout',arguments:{request:p.request,output:p.output}}},{id:5,method:'tools/call',params:{name:'studio_compare_printed_holdout',arguments:{request:p.request,output:join(p.dir,'extra.json'),apply:true}}}];
 const response=spawnSync(process.execPath,[mcp],{input:messages.map(m=>JSON.stringify({jsonrpc:'2.0',...m})).join('\n')+'\n',encoding:'utf8',timeout:30000,maxBuffer:2000000});assert.equal(response.error,undefined);assert.equal(response.status,0,response.stderr);assert.equal(response.stderr,'');
 const replies=response.stdout.trim().split('\n').map(line=>JSON.parse(line)),tool=replies.find(r=>r.id===2).result.tools.find(t=>t.name==='studio_compare_printed_holdout');assert.equal(tool.inputSchema.additionalProperties,false);assert.equal(tool.annotations.readOnlyHint,false);assert.equal(tool.annotations.idempotentHint,false);
 const capabilities=replies.find(r=>r.id===3).result.structuredContent.value;assert.equal(capabilities.printedHoldout.available,true);assert.equal(capabilities.printedHoldout.appliesMaterials,false);assert.equal(capabilities.printedHoldout.physicalIndependenceVerified,false);
 const result=replies.find(r=>r.id===4).result;assert.notEqual(result.isError,true);const summary=result.structuredContent.value;assert.equal(summary.status,'refused');assert(Buffer.byteLength(JSON.stringify(summary))<16384);const a=await artifact(p,{summary});assert.equal(a.refusal.code,'PRINTED_HOLDOUT_FILE_SHA_MISMATCH');assert.equal(a.result,null);assert.equal('rawTraining'in summary,false);assert.equal(replies.find(r=>r.id===5).result.isError,true);await assert.rejects(readFile(join(p.dir,'extra.json')),e=>e.code==='ENOENT');
});
