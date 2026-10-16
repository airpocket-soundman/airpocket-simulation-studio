import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const SU2_WINDOWS_RELEASE=Object.freeze({version:'8.5.0',url:'https://github.com/su2code/SU2/releases/download/v8.5.0/SU2-v8.5.0-win64-omp.zip',sha256:'4466fe21aedb5e0bad57afd45f829acbdec6ec79fe8c3f8954ddea06a4b4bc11',archiveBytes:28043921});
const hash=b=>createHash('sha256').update(b).digest('hex');
const run=(file,args,options={})=>new Promise((res,rej)=>{const p=spawn(file,args,{windowsHide:true,...options});p.once('error',rej);p.once('close',code=>code===0?res():rej(Error(`Setup process exited ${code}`)));});
/** Explicit opt-in setup. No application import downloads or runs native code. */
export async function setupSu2(directory){
 if(process.platform!=='win32'||process.arch!=='x64')throw Error('Only official Windows x64 runtime is verified by this setup');
 const root=resolve(directory);await mkdir(root,{recursive:true});const archive=resolve(root,'runtime.zip');
 let bytes;try{bytes=await readFile(archive);}catch(e){if(e.code!=='ENOENT')throw e;const response=await fetch(SU2_WINDOWS_RELEASE.url);if(!response.ok)throw Error(`SU2 download HTTP ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());}
 if(bytes.length!==SU2_WINDOWS_RELEASE.archiveBytes||hash(bytes)!==SU2_WINDOWS_RELEASE.sha256)throw Error('SU2 release size/hash mismatch');
 await writeFile(archive,bytes);
 const unpack=async(source,destination)=>{await mkdir(destination,{recursive:true});await run('powershell.exe',['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath $env:AIRPOCKET_SU2_ARCHIVE -DestinationPath $env:AIRPOCKET_SU2_DESTINATION -Force'],{env:{...process.env,AIRPOCKET_SU2_ARCHIVE:source,AIRPOCKET_SU2_DESTINATION:destination},stdio:'inherit'});};
 await unpack(archive,resolve(root,'outer'));await unpack(resolve(root,'outer','win64-omp.zip'),resolve(root,'runtime'));
 const executable=resolve(root,'runtime','bin','SU2_CFD.exe');await stat(executable);
 const provenance={schemaVersion:1,...SU2_WINDOWS_RELEASE,executable,executableSha256:hash(await readFile(executable))};
 await writeFile(resolve(root,'runtime.json'),JSON.stringify(provenance,null,2));return provenance;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))setupSu2(process.argv[2]??'.native-cache/su2-8.5.0').then(p=>console.log(JSON.stringify(p,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
