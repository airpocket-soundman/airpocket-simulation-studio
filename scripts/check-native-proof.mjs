import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const nativeProofPin=Object.freeze({commit:'16b0b814a3ba15a56c7a04e02d047188800cc0bf',archiveSha256:'dd5df193d0892234ce68af55b4fbe682e07b168eaa74293394a2ec0ae4f7dfcc',mfemVersion:41000});
export const proofFixtures=Object.freeze([[1e9,100],[2e9,200],[1e9,-100],[1e9,0],[5e8,37.5]]);
export const invalidProofInputs=Object.freeze(['','bad 1e9 100','airpocket-native-proof-v1 -1 100','airpocket-native-proof-v1 0 100','airpocket-native-proof-v1 1e9','airpocket-native-proof-v1 1e9 100 extra','airpocket-native-proof-v1 NaN 100','airpocket-native-proof-v1 1e9 Inf']);
const root=fileURLToPath(new URL('../',import.meta.url));
const fields=['schemaVersion','engine','runtime','mfemVersion','youngPa','loadN','expectedDisplacementM','topDisplacementM','maxDisplacementErrorM','reactionN','forceBalanceErrorN','verifiedResidual'];
export function verifyHostExecutable(bytes,platform=process.platform){
 const magic=Buffer.from(bytes.subarray(0,4)).toString('hex');
 assert.ok(platform==='linux'?magic==='7f454c46':platform==='win32'?magic.startsWith('4d5a'):platform==='darwin'?['cffaedfe','feedfacf','cafebabe','bebafeca'].includes(magic):false,'Host proof must have the current platform native executable header');
}
function near(actual,expected,absolute,relative=1e-7){assert.ok(Math.abs(actual-expected)<=absolute+Math.abs(expected)*relative,`${actual} differs from ${expected}`);}
export function verifyProofOutput(output,{runtime,young,load}){
 assert.deepEqual(Object.keys(output).sort(),fields.slice().sort(),'CLI result contract changed');
 assert.equal(output.schemaVersion,1);assert.equal(output.engine,'mfem-native');assert.equal(output.runtime,runtime);assert.equal(output.mfemVersion,nativeProofPin.mfemVersion);
 for(const key of fields.filter(k=>!['engine','runtime'].includes(k)))assert.ok(Number.isFinite(output[key]),`Nonfinite ${key}`);
 assert.equal(output.youngPa,young);assert.equal(output.loadN,load);
 const expected=load*.04/(young*.0001);
 near(output.expectedDisplacementM,expected,1e-15,1e-12);near(output.topDisplacementM,expected,1e-10);
 assert.ok(output.maxDisplacementErrorM>=0&&output.maxDisplacementErrorM<=1e-10+Math.abs(expected)*1e-7);
 near(output.reactionN,-load,1e-8);assert.ok(output.forceBalanceErrorN>=0&&output.forceBalanceErrorN<=1e-8+Math.abs(load)*1e-7);
 near(output.forceBalanceErrorN,Math.abs(output.reactionN+load),1e-12,1e-6);
 assert.ok(output.verifiedResidual>=0&&output.verifiedResidual<2e-8);
 return output;
}
export function verifyNativeWasmPair(host,wasm,fixture){
 const [young,load]=fixture;verifyProofOutput(host,{runtime:'host-native',young,load});verifyProofOutput(wasm,{runtime:'wasm-development-check',young,load});
 for(const key of ['expectedDisplacementM','topDisplacementM','maxDisplacementErrorM'])near(host[key],wasm[key],1e-10);
 for(const key of ['reactionN','forceBalanceErrorN'])near(host[key],wasm[key],1e-8);
 near(host.verifiedResidual,wasm.verifiedResidual,2e-8);
}
function execute(command,args,options={}){
 const result=spawnSync(command,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:30*60*1000,...options});
 assert.ifError(result.error);assert.equal(result.status,0,`${command} failed (${result.status}): ${result.stderr||''}`);return result;
}
export function runProof(binary,input,{wasm=false}={}){
 if(!wasm)assert.ok(!/\.(?:mjs|cjs|js|wasm)$/i.test(binary),'Host proof must be a native executable');
 return spawnSync(wasm?process.execPath:binary,wasm?[binary]:[],{input,encoding:'utf8',windowsHide:true,timeout:30000,cwd:root});
}
export async function verifyPinnedSource(paths,python=process.env.PYTHON||(process.platform==='win32'?'python':'python3')){
 const source=resolve(paths.mfem),archive=join(root,'.native-cache','mfem.tar.gz');
 assert.equal(basename(source),'mfem-'+nativeProofPin.commit,'MFEM source cache must match pinned commit');
 const bytes=await readFile(archive);assert.equal(createHash('sha256').update(bytes).digest('hex'),nativeProofPin.archiveSha256,'MFEM source archive digest mismatch');
 // Check every original source file, rather than trusting the cache directory name.
 const check=`from pathlib import Path\nimport sys,tarfile,hashlib\nsource=Path(sys.argv[1]); archive=Path(sys.argv[2]); count=0\nwith tarfile.open(archive) as tf:\n for member in tf.getmembers():\n  if not member.isfile(): continue\n  relative=Path(*Path(member.name).parts[1:])\n  if relative.is_absolute() or '..' in relative.parts: raise SystemExit('Unsafe MFEM archive member')\n  actual=source/relative\n  if not actual.is_file() or hashlib.sha256(actual.read_bytes()).digest()!=hashlib.sha256(tf.extractfile(member).read()).digest(): raise SystemExit('MFEM source differs from pinned archive: '+str(relative))\n  count+=1\nif count<100: raise SystemExit('Incomplete MFEM archive')\nprint('Verified '+str(count)+' pinned MFEM source files')`;
 const result=execute(python,['-c',check,source,archive]);process.stdout.write(result.stdout);return {source,archiveSha256:nativeProofPin.archiveSha256};
}
export async function checkNativeProof({build=false,hostBinary,wasmBinary,python=process.env.PYTHON||(process.platform==='win32'?'python':'python3')}={}){
 const paths=JSON.parse(await readFile(join(root,'.native-cache','paths.json'),'utf8')),pin=await verifyPinnedSource(paths,python),buildDirectory=join(root,'.native-cache','native-proof');
 const host=resolve(hostBinary||process.env.AIRPOCKET_NATIVE_PROOF||join(buildDirectory,'airpocket-native-proof'+(process.platform==='win32'?'.exe':''))),wasm=resolve(wasmBinary||process.env.AIRPOCKET_NATIVE_PROOF_WASM||join(root,'.native-cache','native-proof-wasm.cjs'));
 if(build){
  execute('cmake',['-S',join(root,'native','native-proof'),'-B',buildDirectory,'-G','Ninja','-DCMAKE_BUILD_TYPE=Release','-DMFEM_SOURCE_DIR='+pin.source],{stdio:'inherit'});
  execute('cmake',['--build',buildDirectory,'--target','airpocket-native-proof','-j','4'],{stdio:'inherit'});
  execute(python,['scripts/native-proof-wasm.py'],{stdio:'inherit'});
 }
 const hostBytes=await readFile(host);verifyHostExecutable(hostBytes);
 // The pre-existing native test remains a mandatory, non-skipped host execution gate.
 const env={...process.env,AIRPOCKET_NATIVE_PROOF:host,AIRPOCKET_NATIVE_PROOF_WASM:wasm};
 execute(process.execPath,['--test','tests/native-proof.test.mjs','tests/native-proof-contract.test.mjs'],{env,stdio:'inherit'});
 const results=[];
 for(const fixture of proofFixtures){const [young,load]=fixture,input=`airpocket-native-proof-v1 ${young} ${load}\n`,outputs=[];for(const [binary,isWasm,runtime] of [[host,false,'host-native'],[wasm,true,'wasm-development-check']]){const result=runProof(binary,input,{wasm:isWasm});assert.ifError(result.error);assert.equal(result.status,0,result.stderr);const output=JSON.parse(result.stdout);verifyProofOutput(output,{runtime,young,load});outputs.push(output);}verifyNativeWasmPair(...outputs,fixture);results.push({fixture,host:outputs[0],wasm:outputs[1]});}
 for(const binary of [host,wasm])for(const input of invalidProofInputs){const result=runProof(binary,input,{wasm:binary===wasm});assert.ifError(result.error);assert.notEqual(result.status,0);assert.equal(result.stdout,'');assert.match(result.stderr,/Expected airpocket-native-proof-v1/);}
 const sourceHashes={};for(const file of ['native/native-proof/main.cpp','native/mfem-adapter/adapter.cpp'])sourceHashes[file]=createHash('sha256').update(await readFile(join(root,file))).digest('hex');
 const report={schemaVersion:1,verifiedAt:new Date().toISOString(),platform:process.platform,architecture:process.arch,nodeVersion:process.version,pin:nativeProofPin,sourceHashes,hostBinary:host,hostSha256:createHash('sha256').update(hostBytes).digest('hex'),wasmBinary:wasm,wasmLoaderSha256:createHash('sha256').update(await readFile(wasm)).digest('hex'),wasmModuleSha256:createHash('sha256').update(await readFile(wasm.replace(/\.(?:cjs|mjs)$/i,'.wasm'))).digest('hex'),fixtures:results,invalidInputCases:invalidProofInputs.length,hostNativeVerified:true,wasmParityVerified:true,scope:'10 x 10 x 40 mm axial Tet4 bar only; arbitrary saved projects and production native backend remain unverified'};
 await mkdir(join(root,'.native-cache'),{recursive:true});await writeFile(join(root,'.native-cache','native-proof-report.json'),JSON.stringify(report,null,2)+'\n');console.log('Host-native execution and same-source WASM parity verified; report: .native-cache/native-proof-report.json');return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.some(a=>a!=='--build'))throw Error('Usage: node scripts/check-native-proof.mjs [--build]');
 await checkNativeProof({build:args.includes('--build')});
}
