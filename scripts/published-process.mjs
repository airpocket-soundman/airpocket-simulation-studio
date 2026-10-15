import {fileURLToPath} from 'node:url';
import {readFile,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

if(!process.send)throw Error('Published runtime requires a parent IPC channel');
process.on('disconnect',()=>process.exit(0));
let received=false;
const send=value=>{if(process.connected)process.send(value);};
const phase=value=>send({phase:value});
process.on('message',async command=>{
 if(received){send({error:'Published process accepts only one request'});process.exitCode=1;return;}received=true;
 let terminal;
 try{
  phase('initialize');
  if(!command||!['analysis','cad','step-reference','step-changed'].includes(command.task)||typeof command.base!=='string')throw Error('Invalid published task');
  const base=new URL(command.base);if(base.protocol!=='file:'||base.search||base.hash||!base.href.endsWith('/'))throw Error('Published task requires an exact local cache base');
  if(command.task.startsWith('step-')){
   phase('import');const {default:initialize}=await import(new URL('gmsh/gmsh.mjs',base));
   phase('native');const gmsh=await initialize({print:()=>{},printErr:()=>{}});gmsh.initialize();
   try{
    gmsh.option.setNumber('General.Terminal',0);gmsh.model.add('published-process-reference');const tag=gmsh.model.occ.addBox(0,0,0,10,10,command.task==='step-changed'?50:40);gmsh.model.occ.synchronize();gmsh.write('/reference.step');
    const step=Uint8Array.from(gmsh.FS.readFile('/reference.step'));
    if(command.task==='step-reference'){gmsh.model.occ.rotate([3,tag],0,0,0,0,1,0,Math.PI/6);gmsh.model.occ.synchronize();gmsh.write('/oblique.step');terminal={result:{step,obliqueStep:Uint8Array.from(gmsh.FS.readFile('/oblique.step'))}};}else terminal={result:{step}};
   }finally{phase('finalize');gmsh.finalize();}
  }else{
   const module=new URL(command.module);if(module.protocol!=='file:'||!module.href.startsWith(base.href)||module.search||module.hash)throw Error('Published worker module is outside the verified cache');
   const nativeFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>String(url).startsWith('file:')?new Response(await readFile(new URL(url))):nativeFetch(url,options);
   globalThis.self={postMessage:value=>{if(value&&typeof value==='object'&&(Object.hasOwn(value,'result')||Object.hasOwn(value,'error'))){if(terminal)throw Error('Duplicate published terminal result');terminal=value;}}};
   if(command.task==='cad'){
    const original=new URL('cad/occt-import-js.js',base),cjs=new URL('cad/occt-import-js.cjs',base);await copyFile(original,cjs);const factory=createRequire(import.meta.url)(fileURLToPath(cjs));
    globalThis.importScripts=url=>{if(url!==original.href)throw Error('Unexpected CAD script');};
    globalThis.self.occtimportjs=async options=>factory({...options,wasmBinary:await readFile(new URL('cad/occt-import-js.wasm',base))});
   }
   phase('import');await import(module.href);if(typeof globalThis.self.onmessage!=='function')throw Error('Published bundle has no worker handler');
   phase('native');await globalThis.self.onmessage({data:command.request});phase('finalize');
   if(!terminal)throw Error('Published bundle returned no terminal response');
  }
 }catch(error){terminal={error:error?.message??String(error)};}
 phase('result');
 if(process.connected)process.send(terminal,()=>{process.disconnect();process.exit(0);});else process.exit(1);
});
send({ready:true});
