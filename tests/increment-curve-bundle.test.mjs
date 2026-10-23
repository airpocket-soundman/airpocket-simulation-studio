import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {solveElastic} from '../src/fem-core.js';
import {loadedFaceTractionForces} from '../src/increment-curve-data.js';
import {createIncrementCurveArtifacts} from '../src/increment-curve-export.js';
import {createIncrementCurveBundle,writeIncrementCurveBundle,INCREMENT_CURVE_BUNDLE_LIMITS} from '../scripts/increment-curve-bundle-service.mjs';

const referenceRequest={
 synthetic:true,
 curveId:'synthetic-bar-independent-linear-solves',
 caseIdentity:{name:'Synthetic 10x10x40 mm bar',synthetic:true},
 rowIdentity:{materialKey:'synthetic-E1e9-nu0',geometryKey:'box-10x10x40mm',gaugeKey:'weighted-end-faces'},
 boundsMm:[0,0,0,10,10,40],
 meshSizeMm:4,
 youngModulusPa:1e9,
 poissonRatio:0,
 axis:[0,0,1],
 initialGaugeLengthMm:40,
 initialAreaMm2:100,
 loadsN:[0,25,50,100,50,0]
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const relError=(actual,expected)=>Math.abs(actual/expected-1);
const clone=()=>structuredClone(referenceRequest);
function parseCsv(csv){
 const rows=[];let row=[],cell='',quoted=false;
 for(let index=0;index<csv.length;index++){
  const char=csv[index];
  if(char==='"'){if(quoted&&csv[index+1]==='"'){cell+='"';index++;}else quoted=!quoted;}
  else if(char===','&&!quoted){row.push(cell);cell='';}
  else if(char==='\r'&&!quoted&&csv[index+1]==='\n'){row.push(cell);rows.push(row);row=[];cell='';index++;}
  else cell+=char;
 }
 assert.equal(quoted,false);assert.equal(cell,'');return rows;
}
const columns=(csv)=>{
 const [headers,...rows]=parseCsv(csv);
 return {headers,rows,column:name=>headers.indexOf(name)};
};
let generatedPromise;
const generated=()=>generatedPromise??=createIncrementCurveBundle(clone());

test('explicit force route becomes an independently re-solvable revisioned bundle',async()=>{
 const result=await generated(),{bundle,curve}=result;
 assert.deepEqual(Object.keys(bundle),['spec','steps']);
 assert.equal(bundle.spec.input.synthetic,true);
 assert.equal(bundle.spec.initialGaugeLengthMm,40);
 assert.equal(bundle.spec.initialAreaMm2,100);
 assert.equal(bundle.spec.nodeCount,bundle.spec.mesh.nodes.length/3);
 assert.deepEqual(bundle.steps.map(step=>step.controlledValue),[0,25,50,100,50,0]);
 assert.deepEqual(curve.steps.map(row=>row.controlledValue),[0,25,50,100,50,0]);
 assert.equal(curve.steps.length,6);
 assert.ok(curve.steps.every(row=>row.status==='converged'));
 for(const row of curve.steps){assert.ok(Math.abs(row.forceBalanceErrorNAxialN)<=1e-5);assert.match(row.resultRevision,/^sha256:[0-9a-f]{64}$/);}
 const peak=curve.steps[3];
 assert.ok(relError(peak.extensionMm,0.04)<=1e-6);
 assert.ok(relError(peak.engineeringStressPa,1e6)<=1e-6);
 assert.ok(relError(peak.engineeringStrain,0.001)<=1e-6);
 assert.ok(relError(peak.tensileForceN,100)<=1e-6);
 for(const index of [0,5])assert.ok(Math.abs(curve.steps[index].extensionMm)<=1e-12);
 assert.ok(relError(curve.steps[1].extensionMm,0.01)<=1e-6);
 assert.ok(relError(curve.steps[2].extensionMm,0.02)<=1e-6);
 assert.ok(relError(curve.steps[4].extensionMm,0.02)<=1e-6);
 assert.equal(curve.steps[2].resultRevision,curve.steps[4].resultRevision,'separate 50 N solves are deterministic');
 assert.equal(curve.analysis.kind,'independent-linear-solves');
 assert.equal(curve.analysis.plasticHistory,false);
 // Every saved vector must equal a fresh solve at that exact load. A scaled or copied vector fails this.
 for(let index=0;index<bundle.steps.length;index++){
  const step=bundle.steps[index],forces=loadedFaceTractionForces(bundle.spec.mesh,{spec:bundle.spec,totalForceN:step.controlledValue});
  const actual=solveElastic(bundle.spec.mesh,{youngModulus:1e9,poissonRatio:0},{fixed:bundle.spec.fixedNodes,forces});
  for(const key of ['kind','displacement','constraintReactions','applied','residual'])assert.deepEqual(step.output.result[key],actual[key],key+' step '+index);
  assert.deepEqual(step.output.input,bundle.spec.input);
  assert.deepEqual(step.output.mesh,bundle.spec.mesh);
 }
 const artifacts=await createIncrementCurveArtifacts(bundle);
 assert.deepEqual(artifacts.curve,curve);
 assert.deepEqual(JSON.parse(artifacts.json),curve);
});

test('written re-input bundle is read back, revalidated and matches independent CSV/JSON values and revisions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-bundle-'));
 try{
  const requestPath=join(dir,'request.json'),outputPath=join(dir,'bundle.json');
  await writeFile(requestPath,JSON.stringify(referenceRequest)+'\n');
  const summary=await writeIncrementCurveBundle({requestPath,outputPath});
  assert.equal(summary.kind,'increment-curve-reinput-bundle');
  assert.equal(summary.format,'{spec,steps}');
  assert.equal(summary.steps,6);
  assert.equal(summary.convergedSteps,6);
  assert.deepEqual(summary.failedSteps,[]);
  assert.equal(summary.limitations.length,3);
  const savedBytes=await readFile(outputPath),saved=JSON.parse(savedBytes);
  assert.equal(summary.outputBytes,savedBytes.length);
  assert.equal(summary.outputSha256,hash(savedBytes));
  assert.deepEqual(Object.keys(saved),['spec','steps']);
  assert.equal(saved.spec.input.synthetic,true);
  assert.equal(saved.curve,undefined);
  assert.equal(saved.csv,undefined);
  const artifacts=await createIncrementCurveArtifacts(saved);
  assert.deepEqual(artifacts.curve,JSON.parse(artifacts.json));
  const {headers,rows,column}=columns(artifacts.csv);
  assert.equal(rows.length,6);
  for(const index of [0,1,2,3,4,5]){
   const row=rows[index],curveRow=artifacts.curve.steps[index];
   for(const [heading,key] of [['controlledValue[N]','controlledValue'],['extensionMm[mm]','extensionMm'],['tensileForceN[N]','tensileForceN'],['engineeringStressPa[Pa]','engineeringStressPa'],['engineeringStrain[dimensionless]','engineeringStrain'],['inputRevision','inputRevision'],['meshRevision','meshRevision'],['calculationRevision','calculationRevision'],['resultRevision','resultRevision']])assert.equal(row[column(heading)],String(curveRow[key]),heading+' step '+index);
  }
  assert.ok(relError(Number(rows[3][column('extensionMm[mm]')]),0.04)<=1e-6);
  assert.ok(relError(Number(rows[3][column('engineeringStressPa[Pa]')]),1e6)<=1e-6);
  assert.ok(relError(Number(rows[3][column('engineeringStrain[dimensionless]')]),0.001)<=1e-6);
  assert.equal(rows[3][column('inputRevision')],artifacts.curve.inputRevision);
  assert.equal(rows[3][column('meshRevision')],artifacts.curve.meshRevision);
  assert.deepEqual((await readdir(dir)).sort(),['bundle.json','request.json']);
  await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath}),/already exists/);
  assert.deepEqual(await readFile(outputPath),savedBytes);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a real solve failure is preserved as a failed row without a forged converged row',async()=>{
 let calls=0;
 const injected=(mesh,properties,boundary)=>{
  if(++calls===3)throw Error('injected solve failure');
  return solveElastic(mesh,properties,boundary);
 };
 const result=await createIncrementCurveBundle(clone(),{solve:injected});
 assert.equal(result.failures.length,1);
 assert.deepEqual(result.failures[0],{stepIndex:2,stepId:'step-2-50N',loadN:50,message:'injected solve failure'});
 const failed=result.curve.steps[2],raw=result.bundle.steps[2];
 assert.equal(failed.status,'failed');
 assert.equal(failed.converged,false);
 assert.equal(failed.provisional,true);
 assert.equal(raw.output,undefined);
 for(const key of ['inputRevision','meshRevision','calculationRevision','resultRevision','reactionAxisN','tensileForceN','extensionMm','engineeringStressPa','engineeringStrain'])assert.equal(failed[key],null,key);
 for(const index of [0,1,3,4,5])assert.equal(result.curve.steps[index].status,'converged');
 assert.ok(relError(result.curve.steps[3].extensionMm,0.04)<=1e-6);
 assert.ok(relError(result.curve.steps[4].extensionMm,0.02)<=1e-6);
 const parsed=columns(result.csv);
 assert.equal(parsed.rows[2][parsed.column('status')],'failed');
});

test('refused or failed generation never publishes a destination file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-bundle-refuse-'));
 try{
  const requestPath=join(dir,'request.json'),outputPath=join(dir,'bundle.json');
  for(const invalid of [
   {...referenceRequest,synthetic:false},
   {...referenceRequest,loadsN:[]},
   {...referenceRequest,loadsN:Array.from({length:129},()=>0)},
   {...referenceRequest,axis:[0,0,-1]},
   {...referenceRequest,meshSizeMm:1e-9},
   {...referenceRequest,initialAreaMm2:99},
   {...referenceRequest,initialGaugeLengthMm:20},
   {...referenceRequest,rowIdentity:{...referenceRequest.rowIdentity,extra:'x'}}
  ]){
   await writeFile(requestPath,JSON.stringify(invalid));
   await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath}));
   await assert.rejects(stat(outputPath),{code:'ENOENT'});
  }
  await writeFile(requestPath,'not json');
  await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath}),/UTF-8 JSON/);
  await assert.rejects(stat(outputPath),{code:'ENOENT'});
  await writeFile(requestPath,JSON.stringify(referenceRequest));
  await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath:requestPath}),/distinct/);
  await assert.rejects(writeIncrementCurveBundle({requestPath:'relative.json',outputPath}),/absolute/);
  await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath},{create:async()=>{throw Error('generation failed');}}),/generation failed/);
  await assert.rejects(stat(outputPath),{code:'ENOENT'});
  const existing=join(dir,'existing.json');await writeFile(existing,'sentinel');
  await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath:existing}),/already exists/);
  assert.equal(await readFile(existing,'utf8'),'sentinel');
  assert.ok(!(await readdir(dir)).some(name=>name.endsWith('.tmp')));
  const tooLarge={...referenceRequest,caseIdentity:{padding:'x'.repeat(INCREMENT_CURVE_BUNDLE_LIMITS.requestBytes)}};
  await writeFile(requestPath,JSON.stringify(tooLarge));
  await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath}),/64 KiB/);
  await assert.rejects(stat(outputPath),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('the CLI writes only the re-input bundle and refuses overwrite or unknown options',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-bundle-cli-'));
 try{
  const requestPath=join(dir,'request.json'),outputPath=join(dir,'bundle.json');
  await writeFile(requestPath,JSON.stringify(referenceRequest)+'\n');
  const run=args=>spawnSync(process.execPath,['scripts/create-increment-curve-bundle.mjs',...args],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:120000});
  const first=run(['--request',requestPath,'--output',outputPath]);
  assert.equal(first.status,0,first.stderr);
  const summary=JSON.parse(first.stdout);
  assert.equal(summary.kind,'increment-curve-reinput-bundle');
  assert.equal(summary.steps,6);
  assert.equal(summary.failedSteps.length,0);
  const saved=JSON.parse(await readFile(outputPath));
  assert.deepEqual(Object.keys(saved),['spec','steps']);
  assert.equal(saved.curve,undefined);
  assert.deepEqual(await createIncrementCurveArtifacts(saved).then(result=>result.curve.steps.map(row=>row.status)),Array(6).fill('converged'));
  const second=run(['--request',requestPath,'--output',outputPath]);
  assert.equal(second.status,1);
  assert.match(second.stderr,/already exists/);
  const unknown=run(['--request',requestPath,'--output',outputPath,'--extra','x']);
  assert.equal(unknown.status,1);
  assert.match(unknown.stderr,/Usage/);
  assert.deepEqual((await readdir(dir)).sort(),['bundle.json','request.json']);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('request snapshot rejects accessors, cycles and unsupported values before solving',async()=>{
 let accessed=false;
 const accessor=clone();Object.defineProperty(accessor,'curveId',{enumerable:true,get(){accessed=true;return 'x';}});
 await assert.rejects(createIncrementCurveBundle(accessor),/accessors/);
 assert.equal(accessed,false);
 const cycle=clone();cycle.caseIdentity.self=cycle;
 await assert.rejects(createIncrementCurveBundle(cycle),/cyclic/);
 const infinite=clone();infinite.loadsN=[0,Infinity];
 await assert.rejects(createIncrementCurveBundle(infinite),/finite/);
 const hidden=clone();Object.defineProperty(hidden,'extra',{value:1});
 await assert.rejects(createIncrementCurveBundle(hidden),/hidden properties/);
});


test('translated bounds keep the requested box dimensions and end-face loads on every axis',async()=>{
 for(const axisIndex of [0,1,2]){
  const request=clone();
  request.boundsMm=[5,7,11,15,17,51];
  request.axis=[0,0,0];request.axis[axisIndex]=1;
  request.initialGaugeLengthMm=[10,10,40][axisIndex];
  request.initialAreaMm2=[400,400,100][axisIndex];
  request.loadsN=[100];
  const result=await createIncrementCurveBundle(request);
  const {spec}=result.bundle;
  assert.deepEqual(spec.input.sourceModel.bounds,[5,7,11,10,10,40]);
  for(let k=0;k<3;k++){
   const coords=spec.mesh.nodes.filter((_,index)=>index%3===k);
   assert.ok(Math.abs(Math.min(...coords)-request.boundsMm[k])<1e-7);
   assert.ok(Math.abs(Math.max(...coords)-request.boundsMm[k+3])<1e-7);
  }
  for(const node of spec.fixedNodes)assert.ok(Math.abs(spec.mesh.nodes[node*3+axisIndex]-request.boundsMm[axisIndex])<1e-7);
  for(const node of spec.loadedNodes)assert.ok(Math.abs(spec.mesh.nodes[node*3+axisIndex]-request.boundsMm[axisIndex+3])<1e-7);
  const expected=100*request.initialGaugeLengthMm/(request.youngModulusPa*request.initialAreaMm2*1e-6);
  assert.equal(result.curve.steps[0].status,'converged');
  assert.ok(relError(result.curve.steps[0].extensionMm,expected)<1e-6);
 }
});

test('oversized routes stop before computing all rows and publish no file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-bundle-budget-'));
 try{
  const requestPath=join(dir,'request.json'),outputPath=join(dir,'bundle.json');
  const request=clone();request.loadsN=Array(128).fill(100);
  await writeFile(requestPath,JSON.stringify(request));
  let calls=0,cached;
  await assert.rejects(writeIncrementCurveBundle({requestPath,outputPath},{create:input=>createIncrementCurveBundle(input,{solve:(...args)=>{calls++;return cached??=solveElastic(...args);}})}),/limit/);
  assert.ok(calls<128,'bundle budget must stop subsequent solves; observed '+calls);
  await assert.rejects(stat(outputPath),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('invalid solver residuals never become converged rows',async()=>{
 const request=clone();request.loadsN=[100,100,100];let index=0;
 const result=await createIncrementCurveBundle(request,{solve:(...args)=>({...solveElastic(...args),residual:[-1,Infinity,1e-8][index++]})});
 assert.deepEqual(result.curve.steps.map(step=>step.status),['failed','failed','failed']);
 assert.equal(result.failures.length,3);
 for(const step of result.bundle.steps)assert.equal(step.output,undefined);
});
