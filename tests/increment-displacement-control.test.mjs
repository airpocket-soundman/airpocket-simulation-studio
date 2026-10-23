import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createIncrementCurveBundle,writeIncrementCurveBundle} from '../scripts/increment-curve-bundle-service.mjs';
import {readIncrementCurve} from '../scripts/increment-curve-service.mjs';
import {solveElastic} from '../src/fem-core.js';
import {createIncrementCurveArtifacts} from '../src/increment-curve-export.js';
import {createIncrementCurveComparison} from '../src/increment-curve-comparison.js';
import {buildIncrementCurve,extractIncrementMeasurement} from '../src/increment-curve-data.js';
const request=()=>({synthetic:true,curveId:'synthetic-displacement-reference',caseIdentity:{name:'synthetic bar'},rowIdentity:{materialKey:'E1e9-nu0',geometryKey:'10x10x40',gaugeKey:'end-faces'},boundsMm:[0,0,0,10,10,40],meshSizeMm:8,youngModulusPa:1e9,poissonRatio:0,axis:[0,0,1],initialGaugeLengthMm:40,initialAreaMm2:100,controlledQuantity:'displacement',displacementsMm:[0,.01,.04,.02,0,-.02]});
const close=(actual,expected,abs=1e-7)=>assert.ok(Math.abs(actual-expected)<=abs,`${actual} versus ${expected}`);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let generatedPromise;
const generated=()=>generatedPromise??=createIncrementCurveBundle(request());

test('prescribed-displacement steps solve independently and recover tensile/compressive force from opposed reactions',async()=>{
 const input=request(),before=structuredClone(input);let calls=0;
 const result=await createIncrementCurveBundle(input,{solve:(...args)=>{calls++;return solveElastic(...args);}});assert.deepEqual(input,before);assert.equal(calls,6);assert.equal(result.failures.length,0);
 const expectedForces=[0,25,100,50,0,-50];
 for(const [i,step] of result.bundle.steps.entries()){
  const row=result.curve.steps[i],actual=solveElastic(result.bundle.spec.mesh,{youngModulus:1e9,poissonRatio:0},step.output.calculation.boundary);
  assert.equal(row.status,'converged');assert.equal(row.controlledQuantity,'displacement');assert.equal(row.controlledUnit,'mm');close(row.extensionMm,input.displacementsMm[i],1e-10);close(row.tensileForceN,expectedForces[i]);close(row.actuatorReactionAxisN,expectedForces[i]);close(row.reactionAxisN,-expectedForces[i]);close(row.forceBalanceErrorNAxialN,0);assert.equal(row.externalAppliedAxisN,0);
  close(row.engineeringStressPa,expectedForces[i]/1e-4,1e-3);close(row.engineeringStrain,input.displacementsMm[i]/40,1e-12);
  for(const key of ['kind','displacement','constraintReactions','applied','residual'])assert.deepEqual(step.output.result[key],actual[key]);
  assert.equal(step.output.calculation.plasticHistory,false);assert.deepEqual(actual.applied,[0,0,0]);
 }
 assert.equal(result.curve.analysis.kind,'independent-linear-solves');assert.equal(result.curve.analysis.plasticHistory,false);assert.deepEqual(JSON.parse(JSON.stringify(result.bundle)),result.bundle);
 assert.match(result.csv.split('\r\n')[0],/controlledValue\[controlledUnit\]/);assert.deepEqual(JSON.parse(result.json),result.curve);
});

test('translated boxes on X/Y/Z impose the declared end-face displacement and match EA u/L',async()=>{
 for(const axisIndex of [0,1,2]){
  const r=request();r.boundsMm=[5,7,11,15,17,51];r.axis=[0,0,0];r.axis[axisIndex]=1;r.initialGaugeLengthMm=[10,10,40][axisIndex];r.initialAreaMm2=[400,400,100][axisIndex];r.displacementsMm=[.01];
  const result=await createIncrementCurveBundle(r),{spec}=result.bundle;
  assert.deepEqual(spec.input.sourceModel.bounds,[5,7,11,10,10,40]);
  const expected=r.youngModulusPa*r.initialAreaMm2*1e-6*.01/r.initialGaugeLengthMm;
  close(result.curve.steps[0].tensileForceN,expected,1e-6);close(result.curve.steps[0].extensionMm,.01,1e-10);
  for(const node of spec.fixedNodes)close(spec.mesh.nodes[node*3+axisIndex],r.boundsMm[axisIndex]);for(const node of spec.loadedNodes)close(spec.mesh.nodes[node*3+axisIndex],r.boundsMm[axisIndex+3]);
 }
});

test('saved displacement bundles reject missing, contradictory and forged boundary/constraint/reaction evidence',async()=>{
 const {bundle}=await generated();
 const changes=[b=>delete b.steps[2].output.calculation.boundary,b=>b.steps[2].output.calculation.boundary.fixed.pop(),b=>b.steps[2].output.calculation.boundary.displacements.pop(),b=>b.steps[2].output.calculation.boundary.displacements[0].valueMm=.03,b=>b.steps[2].output.calculation.boundary.displacements[0].direction=[1,0,0],b=>b.steps[2].output.calculation.boundary.forces.push({node:0,value:[0,0,1]}),b=>b.steps[2].output.result.displacement[b.spec.loadedNodes[0]*3+2]+=.001,b=>b.steps[2].output.result.displacement[b.spec.fixedNodes[0]*3]+=.001,b=>b.steps[2].output.result.constraintReactions=b.steps[2].output.result.constraintReactions.filter(r=>r.node!==b.spec.loadedNodes[0]),b=>b.steps[2].output.result.constraintReactions.find(r=>r.node===b.spec.loadedNodes[0]).force[2]+=1,b=>b.steps[2].output.result.applied[2]=1,b=>b.steps[2].output.calculation.controlledUnit='N',b=>b.steps[2].output.result.residual=1,b=>b.steps[2].output.result.plasticity={},b=>b.steps[2].output.calculation.plasticHistory=true];
 for(const change of changes){const bad=structuredClone(bundle);change(bad);const before=structuredClone(bad);await assert.rejects(createIncrementCurveArtifacts(bad));assert.deepEqual(bad,before);}
});

test('invalid or mixed control requests refuse before meshing; legacy and explicit force requests remain identical',async()=>{
 const valid=request();
 for(const change of [r=>r.loadsN=[100],r=>delete r.controlledQuantity,r=>r.controlledQuantity='strain',r=>r.controlledQuantity=null,r=>r.displacementsMm=[],r=>r.displacementsMm=Array(129).fill(0),r=>r.displacementsMm=[Infinity],r=>r.displacementsMm=['.04'],r=>r.axis=[0,0,-1]]){
  const bad=structuredClone(valid);change(bad);let initialized=false;await assert.rejects(createIncrementCurveBundle(bad,{initialize:()=>{initialized=true;throw Error('must not mesh');}}));assert.equal(initialized,false);
 }
 const force=request();delete force.controlledQuantity;delete force.displacementsMm;force.loadsN=[0,100];force.curveId='legacy-force';
 assert.deepEqual((await createIncrementCurveBundle(force)).bundle,(await createIncrementCurveBundle({...force,controlledQuantity:'force'})).bundle);
});

test('saved failed rows and direct measurements require string control enums without array coercion',async()=>{
 const force=JSON.parse(await readFile(new URL('../public/examples/increment-comparison-a.json',import.meta.url),'utf8'));
 for(const invalid of [['force'],['displacement'],null,1,{}]){
  const bad=structuredClone(force);bad.steps.find(step=>!step.converged).controlledQuantity=invalid;
  const before=structuredClone(bad);await assert.rejects(buildIncrementCurve(bad),/controlledQuantity must be force or displacement/);assert.deepEqual(bad,before);
  await assert.rejects(createIncrementCurveArtifacts(bad),/controlledQuantity must be force or displacement/);
  assert.throws(()=>extractIncrementMeasurement({spec:force.spec,result:force.steps.find(step=>step.converged).output.result,controlledQuantity:invalid}),/controlledQuantity must be force or displacement/);
 }
});

test('failed displacement solves retain mm control but no forged output or measurement',async()=>{
 const r=request();r.displacementsMm=[.01,.02,.03];let count=0;
 const result=await createIncrementCurveBundle(r,{solve:(...args)=>{if(++count===2)throw Error('synthetic solve failure');return solveElastic(...args);}});
 assert.equal(result.bundle.steps[1].controlledQuantity,'displacement');assert.equal(result.bundle.steps[1].controlledValue,.02);assert.equal(result.bundle.steps[1].output,undefined);assert.equal(result.curve.steps[1].controlledUnit,'mm');assert.equal(result.curve.steps[1].status,'failed');assert.equal(result.curve.steps[1].extensionMm,null);assert.equal(result.failures[0].displacementMm,.02);assert.equal(result.failures[0].loadN,undefined);close(result.curve.steps[2].tensileForceN,75,1e-6);
});

test('displacement request CLI and formal stdio MCP retain raw bundle, mm units and artifact byte hashes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'curve-displacement-cli-'));
 try{
  const input=request();input.displacementsMm=[.04,-.02];const requestPath=join(dir,'request.json'),outputPath=join(dir,'bundle.json');await writeFile(requestPath,JSON.stringify(input));
  const cwd=fileURLToPath(new URL('../',import.meta.url));
  const cli=spawnSync(process.execPath,['scripts/create-increment-curve-bundle.mjs','--request',requestPath,'--output',outputPath],{cwd,encoding:'utf8',timeout:30000,maxBuffer:65536});assert.ifError(cli.error);assert.equal(cli.status,0,cli.stderr);const summary=JSON.parse(cli.stdout),raw=await readFile(outputPath);assert.equal(summary.outputBytes,raw.length);assert.equal(summary.outputSha256,hash(raw));assert.equal(summary.convergedSteps,2);assert.equal(summary.controlledUnit,'mm');assert.equal(summary.controlledQuantity,'displacement');
  const artifactPath=join(dir,'artifacts.json'),messages=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'studio_increment_curve',arguments:{path:outputPath,outputPath:artifactPath}}}];
  const mcp=spawnSync(process.execPath,['scripts/studio-mcp.mjs'],{cwd,input:messages.map(m=>JSON.stringify(m)).join('\n')+'\n',encoding:'utf8',timeout:30000,maxBuffer:262144});assert.ifError(mcp.error);assert.equal(mcp.status,0,mcp.stderr);const reply=mcp.stdout.trim().split('\n').map(JSON.parse).find(m=>m.id===2);assert.notEqual(reply.result.isError,true,JSON.stringify(reply.result));const data=reply.result.structuredContent.value;assert.equal(data.page.steps[0].controlledUnit,'mm');assert.equal(data.page.steps[0].controlledQuantity,'displacement');assert.match(data.limitations[0],/prescribed-displacement/);
  const saved=JSON.parse(await readFile(artifactPath));for(const kind of ['csv','json','svg'])assert.equal(hash(Buffer.from(saved[kind],'utf8')),data.artifacts[kind].sha256);
  assert.deepEqual(await readFile(outputPath),raw);await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath}),/exists/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('mixed force/displacement comparisons label control units correctly even when force is first and pages are empty',async()=>{
 const disp=await generated(),force=JSON.parse(await readFile(new URL('../public/examples/increment-comparison-a.json',import.meta.url),'utf8')),wrapper={bundles:[force,disp.bundle]};
 const result=await createIncrementCurveComparison(wrapper);assert.match(result.csv.split('\r\n')[0],/controlledValue\[controlledUnit\]/);assert.match(result.csv,/'?"displacement"/);
 const dir=await mkdtemp(join(tmpdir(),'curve-displacement-page-'));try{const path=join(dir,'input.json');await writeFile(path,JSON.stringify(wrapper));const page=await readIncrementCurve({path,offset:6,limit:1});assert.ok(page.pages.every(value=>value.page.steps.length===0));assert.match(page.limitations[0],/prescribed-displacement/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('oversized displacement bundles stop subsequent real solves and never publish partial output',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'curve-displacement-budget-'));try{
  const r=request();r.displacementsMm=Array(128).fill(.01);const requestPath=join(dir,'request.json'),outputPath=join(dir,'out.json');await writeFile(requestPath,JSON.stringify(r));let calls=0;
  await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath},{create:input=>createIncrementCurveBundle(input,{solve:(...args)=>{calls++;return solveElastic(...args);}})}),/limit/);assert.ok(calls<128);assert.ok(calls>0);await assert.rejects(stat(outputPath),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('displacement request and MCP rows enforce explicit control and correlated units in TypeScript',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--strict','--noEmit','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--types','','tests/fixtures/increment-displacement-types.ts'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:30000,maxBuffer:65536});assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
});

test('saved bundle byte budget includes its publication newline before any output is written',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'curve-displacement-file-edge-'));try{
  const requestPath=join(dir,'request.json'),outputPath=join(dir,'out.json');await writeFile(requestPath,JSON.stringify(request()));
  // Private generation seam isolates the file-byte guard; it is not a physical solve claim.
  const value=structuredClone(await generated());value.bundle.spec.caseIdentity.padding='';const room=1048576-Buffer.byteLength(JSON.stringify(value.bundle));value.bundle.spec.caseIdentity.padding='x'.repeat(room);assert.equal(Buffer.byteLength(JSON.stringify(value.bundle)),1048576);
  let published=false;await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath},{create:async()=>value,publish:async()=>{published=true;throw Error('must not publish');}}),/including newline/);assert.equal(published,false);await assert.rejects(stat(outputPath),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('published generator schema describes the explicit mutually exclusive force/mm request contract',async()=>{
 const schema=JSON.parse(await readFile(new URL('../scripts/increment-curve-bundle-request.schema.json',import.meta.url))),example=JSON.parse(await readFile(new URL('../public/examples/increment-displacement-request.json',import.meta.url)));
 assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');assert.equal(schema.additionalProperties,false);
 assert.ok(schema.required.every(key=>Object.hasOwn(example,key)));assert.ok(Object.keys(example).every(key=>Object.hasOwn(schema.properties,key)));
 assert.deepEqual(schema.oneOf.map(branch=>branch.properties.controlledQuantity.const),['force','displacement']);
 assert.deepEqual(schema.oneOf[0].required,['loadsN']);assert.deepEqual(schema.oneOf[0].not.required,['displacementsMm']);assert.deepEqual(schema.oneOf[1].required,['controlledQuantity','displacementsMm']);assert.deepEqual(schema.oneOf[1].not.required,['loadsN']);
 for(const key of ['loadsN','displacementsMm']){assert.equal(schema.properties[key].minItems,1);assert.equal(schema.properties[key].maxItems,128);assert.equal(schema.properties[key].items.type,'number');}
 const actual=await createIncrementCurveBundle(example);assert.equal(actual.curve.steps.length,example.displacementsMm.length);assert.ok(actual.curve.steps.every(row=>row.controlledQuantity==='displacement'&&row.controlledUnit==='mm'));
});
