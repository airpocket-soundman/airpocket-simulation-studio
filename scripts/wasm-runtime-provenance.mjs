import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,realpath,stat} from 'node:fs/promises';
import {dirname,resolve,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const defaultRoot=fileURLToPath(new URL('../',import.meta.url));
const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
async function record(path,role,headlessDependency){
 const actual=await realpath(path),before=await stat(actual);if(!before.isFile())throw Error('Runtime provenance requires a regular file: '+role);
 const hash=createHash('sha256');for await(const bytes of createReadStream(actual))hash.update(bytes);
 const after=await stat(actual);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ino!==after.ino)throw Error('Runtime provenance file changed while hashing: '+role);
 return {role,path:actual,bytes:before.size,sha256:hash.digest('hex'),headlessDependency};
}
/** Hash fixed local loader/assets without importing or executing their modules.
 * This is identity evidence, not proof that a runtime is safe or unmodified later.
 * resolveGmsh is a trusted resolver seam for fixture tests, never a wire argument. */
export async function inspectWasmRuntimeProvenance({root=defaultRoot,runtimeExecutable=process.execPath,actualRuntimeExecutable=runtimeExecutable,parentExecutable=process.execPath,resolveGmsh=()=>import.meta.resolve('@loumalouomega/gmsh-wasm')}={}){
 for(const path of [root,runtimeExecutable,actualRuntimeExecutable,parentExecutable])if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0'))throw Error('Runtime provenance paths must be absolute local paths');
 const [requested,actual]=await Promise.all([realpath(runtimeExecutable),realpath(actualRuntimeExecutable)]);if(!same(requested,actual))throw Error('Selected runtime identity does not match the requested executable');
 const resolved=new URL(resolveGmsh());if(resolved.protocol!=='file:')throw Error('Gmsh must resolve to a local file');const entry=fileURLToPath(resolved);if(basename(entry)!=='gmsh.mjs')throw Error('Unexpected Gmsh ESM loader entry');const dist=dirname(entry),manifest=resolve(dist,'../package.json'),pkg=JSON.parse(await readFile(manifest,'utf8'));if(pkg.name!=='@loumalouomega/gmsh-wasm'||typeof pkg.version!=='string'||!pkg.version)throw Error('Unexpected Gmsh package manifest');
 const fixed=[['gmsh-package',manifest,true],['gmsh-entry',entry,true],...['gmsh-core.mjs','gmsh-core.wasm','runtime.mjs','gmsh-descriptor.mjs'].map(name=>['gmsh-resolved-'+name,resolve(dist,name),true]),['gmsh-worker-wrapper',resolve(root,'scripts/worker-runtime/gmsh/gmsh.mjs'),true],['mfem-worker-wrapper',resolve(root,'scripts/worker-runtime/mfem/mfem.mjs'),true],['mfem-entry',resolve(root,'public/mfem/mfem.mjs'),true],['mfem-wasm',resolve(root,'public/mfem/mfem.wasm'),true],['fem-kernel-wasm',resolve(root,'public/fem-kernel.wasm'),true],...['gmsh.mjs','gmsh-core.mjs','gmsh-core.wasm','runtime.mjs','gmsh-descriptor.mjs'].map(name=>['gmsh-public-copy-'+name,resolve(root,'public/gmsh',name),false])];
 const loadedAssets=[];for(const [role,path,headlessDependency]of fixed)loadedAssets.push(await record(path,role,headlessDependency));
 const child=await record(actual,'selected-node-executable',true),parent=await record(parentExecutable,'parent-node-executable',true);
 return {provenanceBasis:'resolved-local-dependencies-not-load-tracing',loadedAssets,runtimeBinarySha256:child.sha256,parentRuntimeBinarySha256:parent.sha256,runtimeBinary:{path:child.path,bytes:child.bytes},parentRuntimeBinary:{path:parent.path,bytes:parent.bytes},sameRuntimeBinary:child.sha256===parent.sha256,runtimeIdentityMatchesRequested:true,resolvedPackages:[{name:pkg.name,version:pkg.version,manifestPath:await realpath(manifest)}]};
}
