import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm,readdir,link,symlink,realpath,truncate} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {identifyPrintedParameters} from '../src/printed-parameter-identification.js';
import {PRINTED_IDENTIFICATION_FILE_LIMITS as LIMITS,parsePrintedIdentificationArgs} from '../scripts/printed-identification-file-service.mjs';
const cli=fileURLToPath(new URL('../scripts/identify-printed-parameters.mjs',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const opts={model:'linear-elastic',maxStrain:.02,minPoints:3,maxRelativeStandardError:.1};
function dataset(){return JSON.stringify({schemaVersion:1,id:'independent-file-fixture',revision:'1',provenance:'synthetic',units:{length:'mm',force:'N',time:'s',temperature:'degC',speed:'mm/s'},instrument:{id:'synthetic-no-instrument',hardwareRevision:'1',softwareRevision:'1'},calibration:{status:'unverified',forceEvidence:null,displacementEvidence:null,dimensionEvidence:null},specimens:[2e9,3e9].map((E,k)=>({id:'synthetic-'+k,dimensions:[2,5,20],gaugeLength:10,buildDirection:[0,0,1],batch:'synthetic-no-measurement',temperature:23,speed:1,displacementKind:'gauge',samples:[0,1,2,3,4,5].map(i=>[i,E*(i*.01/10)*(10*1e-6),i*.01])}))});}
async function files(t){const temp=await realpath(tmpdir()),dir=await mkdtemp(join(temp,'printed-identification-cli-'));assert.equal(dirname(dir),temp);assert(basename(dir).startsWith('printed-identification-cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));const paths={dataset:join(dir,'dataset.json'),options:join(dir,'options.json'),output:join(dir,'new-result.json')};await writeFile(paths.dataset,dataset());await writeFile(paths.options,JSON.stringify(opts));return {dir,...paths};}
const args=p=>['--dataset',p.dataset,'--options',p.options,'--output',p.output];
function run(p,extra={}){const r=spawnSync(process.execPath,[cli,...(Array.isArray(p)?p:args(p))],{encoding:'utf8',timeout:30000,maxBuffer:65536,...extra});assert.equal(r.signal,null,r.stderr);assert.equal(r.error,undefined);assert.equal(r.stderr,'');const summary=JSON.parse(r.stdout);return {...r,summary};}
async function artifact(p,r){const b=await readFile(p.output);assert.equal(b.length,r.summary.outputBytes);assert.equal(sha(b),r.summary.outputSha256);return JSON.parse(b);}
async function absent(path){await assert.rejects(readFile(path),e=>e.code==='ENOENT');}

test('real CLI agrees with pure gate and independent exact tensile regression/aggregate, preserves input bytes',async t=>{
 const p=await files(t),before=await readFile(p.dataset),options=await readFile(p.options),r=run(p);assert.equal(r.status,0);const a=await artifact(p,r),pure=await identifyPrintedParameters(before.toString(),JSON.parse(options));assert.deepEqual(a.result,pure);assert.equal(a.status,'identified');assert.equal(a.calibrated,false);assert.equal(a.accuracyVerified,false);assert.equal(a.inputs.dataset.sha256,sha(before));assert.equal(a.inputs.options.sha256,sha(options));
 // Independent force/area and displacement/gauge reduction plus through-origin LS, no importer/fit helper.
 const input=JSON.parse(before);for(let i=0;i<2;i++){const s=input.specimens[i],x=s.samples.map(v=>v[2]/10),y=s.samples.map(v=>v[1]/1e-5),E=x.reduce((v,z,k)=>v+z*y[k],0)/x.reduce((v,z)=>v+z*z,0);assert(Math.abs(a.result.specimens[i].parameters.youngsModulusPa.value/E-1)<1e-14);}
 assert(Math.abs(a.result.across.youngsModulusPa.mean/2.5e9-1)<1e-14);assert(Math.abs(a.result.across.youngsModulusPa.sampleStandardDeviation/(1e9/Math.sqrt(2))-1)<1e-14);
 assert.deepEqual(await readFile(p.dataset),before);assert.deepEqual(await readFile(p.options),options);assert.deepEqual((await readdir(p.dir)).sort(),['dataset.json','new-result.json','options.json']);
});
test('fit refusal is an exclusive artifact with original reasons and no invented parameter values',async t=>{
 const p=await files(t);await writeFile(p.options,JSON.stringify({...opts,minPoints:100}));const r=run(p),a=await artifact(p,r);assert.equal(r.status,2);assert.equal(a.status,'refused');assert.equal(r.summary.refusalCode,'PRINTED_IDENTIFICATION_FIT_REFUSED');assert.equal(a.result.identified,false);for(const s of a.result.specimens){assert.equal(s.identified,false);assert.equal(s.reason,'too-few-points');assert.equal('parameters'in s,false);}assert.equal(a.result.across,null);
});
test('invalid JSON/options/UTF8 are bounded private refusals retaining exact available input SHA',async t=>{
 const p=await files(t);const cases=[{target:'dataset',raw:Buffer.from('{"private-person":"do-not-copy",')},{target:'dataset',raw:Buffer.from([0xc3,0x28])},{target:'dataset',raw:Buffer.from('\ufeff'+dataset())},{target:'options',raw:Buffer.from('{"model":"linear-elastic","mo\\u0064el":"linear-elastic"}')},{target:'options',raw:Buffer.from(JSON.stringify({...opts,unknown:1}))},{target:'options',raw:Buffer.from('{"model":"linear-elastic","maxStrain":1e999,"minPoints":3,"maxRelativeStandardError":0.1}')},{target:'options',raw:Buffer.from('{"model":"linear-elastic","maxStrain":{},"minPoints":3,"maxRelativeStandardError":0.1}')}];
 for(let i=0;i<cases.length;i++){await writeFile(p.dataset,dataset());await writeFile(p.options,JSON.stringify(opts));const c=cases[i];await writeFile(p[c.target],c.raw);const request={...p,output:join(p.dir,'refused-'+i+'.json')},r=run(request),a=await artifact(request,r);assert.equal(r.status,2);assert.equal(a.result,null);assert.equal(a.inputs[c.target].sha256,sha(c.raw));assert.match(a.refusal.code,/^PRINTED_/);assert.equal(JSON.stringify(a).includes('do-not-copy'),false);assert.equal(JSON.stringify(a).includes('stack'),false);assert.deepEqual(await readFile(p[c.target]),c.raw);}
});
test('native absolute distinct paths and exact flags required; existing file/directory and hardlink aliases stay unchanged',async t=>{
 const p=await files(t),source=await readFile(p.dataset);for(const argv of [[],['--dataset',p.dataset,'--dataset',p.dataset,'--output',p.output],['--wrong',p.dataset,'--options',p.options,'--output',p.output],args({...p,dataset:'relative.json'}),args({...p,output:p.dataset}),args({...p,options:p.dataset})]){assert.equal(run(argv).status,1);await absent(p.output);}
 await writeFile(p.output,'existing-untouched');assert.equal(run(p).status,1);assert.equal(await readFile(p.output,'utf8'),'existing-untouched');await rm(p.output);await mkdir(p.output);assert.equal(run(p).status,1);await rm(p.output,{recursive:true});await link(p.dataset,join(p.dir,'alias.json'));assert.equal(run({...p,options:join(p.dir,'alias.json')}).summary.code,'PRINTED_IDENTIFICATION_PATH_ALIAS');assert.deepEqual(await readFile(p.dataset),source);
 const dirInput={...p,dataset:p.dir};assert.equal(run(dirInput).status,1);if(process.platform==='win32')assert.equal(run({...p,output:p.dataset.toUpperCase()}).status,1);
 assert.throws(()=>parsePrintedIdentificationArgs(['--dataset',p.dataset,'--options',p.options,'--output',p.output,'--extra','x']));
});
test('fixed file-byte bounds accept exact capacities and refuse oversized/sparse inputs without publishing partial fits',async t=>{
 const p=await files(t);await writeFile(p.dataset,dataset().padEnd(LIMITS.datasetBytes,' '));await writeFile(p.options,JSON.stringify(opts).padEnd(LIMITS.optionsBytes,' '));let r=run(p),a=await artifact(p,r);assert.equal(r.status,0);assert.equal(a.inputs.dataset.bytes,2000000);assert.equal(a.inputs.options.bytes,16384);await rm(p.output);
 await truncate(p.dataset,100000000);r=run(p);a=await artifact(p,r);assert.equal(r.status,2);assert.equal(a.refusal.code,'PRINTED_IDENTIFICATION_BYTE_LIMIT');assert.equal(a.result,null);assert.equal(a.inputs.dataset,null);assert.deepEqual((await readdir(p.dir)).filter(n=>n.endsWith('.tmp')),[]);
});
test('symlink/junction directory components refuse before read or publication',async t=>{
 const p=await files(t),realDir=join(p.dir,'real'),alias=join(p.dir,'alias');await mkdir(realDir);await writeFile(join(realDir,'input.json'),dataset());await symlink(realDir,alias,process.platform==='win32'?'junction':'dir');let r=run({...p,dataset:join(alias,'input.json')});assert.equal(r.summary.code,'PRINTED_IDENTIFICATION_SYMLINK');await absent(p.output);r=run({...p,output:join(alias,'new.json')});assert.equal(r.summary.code,'PRINTED_IDENTIFICATION_SYMLINK');await absent(join(realDir,'new.json'));
});
test('two real concurrent CLI writers publish exactly one complete artifact and clean owned temporary files',async t=>{
 const p=await files(t);const launch=()=>new Promise((resolve,reject)=>{const c=spawn(process.execPath,[cli,...args(p)]);let out='',err='';c.stdout.on('data',b=>out+=b);c.stderr.on('data',b=>err+=b);c.once('error',reject);c.once('close',(code,signal)=>resolve({code,signal,out,err}));});const results=await Promise.all([launch(),launch()]);assert.deepEqual(results.map(r=>r.code).sort(),[0,1]);assert(results.every(r=>r.signal===null&&r.err===''));const winner=results.find(r=>r.code===0),summary=JSON.parse(winner.out);await artifact(p,{summary});assert.equal(JSON.parse(results.find(r=>r.code===1).out).code,'PRINTED_IDENTIFICATION_OUTPUT_EXISTS');assert.deepEqual((await readdir(p.dir)).sort(),['dataset.json','new-result.json','options.json']);
});

test('bilinear and SLS explicit model options reach the same pure results through real CLI files',async t=>{
 const {syntheticDataset,ramp,bilinearStress,relaxationCurve}=await import('./fixtures/printed-identification-synthetic.mjs');const p=await files(t);const cases=[{data:syntheticDataset({curves:ramp(100,.06,bilinearStress()),noisePa:0}),opts:{model:'bilinear-elastic-plastic',maxStrain:.08,minPoints:5,maxRelativeStandardError:.1,maxTangentRatio:.5}},{data:syntheticDataset({curves:relaxationCurve({n:60}),noisePa:0}),opts:{model:'sls-relaxation',maxStrain:1,minPoints:10,maxRelativeStandardError:.1,holdStrainTolerance:1e-6}}];for(let i=0;i<cases.length;i++){const c=cases[i],q={...p,output:join(p.dir,'model-'+i+'.json')};await writeFile(p.dataset,c.data);await writeFile(p.options,JSON.stringify(c.opts));const r=run(q),a=await artifact(q,r);assert.equal(r.status,0);assert.deepEqual(a.result,await identifyPrintedParameters(c.data,c.opts));}
});
test('saved-file service public declarations retain false calibration and explicit path contracts',()=>{
 const compiler=fileURLToPath(new URL('../node_modules/typescript/bin/tsc',import.meta.url)),fixture=fileURLToPath(new URL('./fixtures/printed-identification-file-types.ts',import.meta.url));const r=spawnSync(process.execPath,[compiler,'--strict','--noEmit','--skipLibCheck','false','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--types','',fixture],{encoding:'utf8',timeout:30000});assert.equal(r.status,0,r.stdout+r.stderr);
});

test('declared measured provenance is retained without calibration or accuracy promotion (synthetic numeric fixture)',async t=>{
 const p=await files(t),data=JSON.parse(dataset());data.provenance='measured';await writeFile(p.dataset,JSON.stringify(data));const r=run(p),a=await artifact(p,r);assert.equal(r.status,0);assert.equal(a.result.dataset.provenance,'measured');assert.equal(a.result.calibrated,false);assert.equal(a.result.accuracyVerified,false);assert.equal(a.calibrated,false);assert.equal(a.accuracyVerified,false);
});
