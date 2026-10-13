import {readFile,writeFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {sha256,validateRuntimeManifest} from './runtime-manifest.mjs';
const root=new URL('../dist/',import.meta.url),files={};
for(const dir of ['assets','gmsh','mfem','cad'])for(const name of await readdir(new URL(dir+'/',root))){if(!/\.(mjs|js|wasm|css)$/.test(name))continue;const path=dir+'/'+name,bytes=await readFile(new URL(path,root));files[path]={bytes:bytes.length,sha256:sha256(bytes)};}
for(const path of ['index.html','development.html','progress.json','coi-serviceworker.js','fem-kernel.wasm']){const bytes=await readFile(new URL(path,root));files[path]={bytes:bytes.length,sha256:sha256(bytes)};}
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')),revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8',windowsHide:true}).trim();
const manifest=validateRuntimeManifest({schema:1,version:pkg.version,revision,dirty,files,runtime:{analysisWorker:Object.keys(files).find(p=>/^assets\/analysis\.worker-/.test(p)),cadWorker:Object.keys(files).find(p=>/^assets\/cad\.worker-/.test(p))}});
await writeFile(new URL('runtime-manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log('Runtime manifest: '+manifest.version+' / '+revision.slice(0,7));
