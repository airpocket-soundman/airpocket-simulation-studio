import {build} from 'vite';
import {isBuiltin} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './runtime-manifest.mjs';
export const browserConnectorPath='assets/studio-browser-mcp.mjs';
/** Build-time Vite only. The emitted file contains repository contract/transport
 * code and imports Node builtins only; no npm install is needed to run it. */
export async function buildBrowserConnector({outDir=fileURLToPath(new URL('../dist/assets/',import.meta.url))}={}){
 const entry=fileURLToPath(new URL('./studio-browser-mcp.mjs',import.meta.url));
 const result=await build({configFile:false,publicDir:false,logLevel:'warn',ssr:{noExternal:true},build:{ssr:entry,target:'node24',outDir,emptyOutDir:false,copyPublicDir:false,write:false,minify:false,sourcemap:false,rollupOptions:{external:id=>isBuiltin(id),output:{format:'es',entryFileNames:'studio-browser-mcp.mjs',inlineDynamicImports:true}}}});
 const output=(Array.isArray(result)?result:[result]).flatMap(r=>r.output??[]);
 if(output.length!==1||output[0].type!=='chunk'||output[0].fileName!=='studio-browser-mcp.mjs')throw Error('Browser connector must emit exactly one ESM file');
 const chunk=output[0],imports=[...chunk.imports,...chunk.dynamicImports];if(imports.some(id=>!isBuiltin(id))||Object.keys(chunk.modules).some(id=>id.replaceAll('\\','/').includes('/node_modules/')))throw Error('Standalone browser connector contains a non-builtin runtime dependency');
 await mkdir(outDir,{recursive:true});const path=resolve(outDir,chunk.fileName);await writeFile(path,chunk.code);
 return {path,bytes:Buffer.byteLength(chunk.code),sha256:sha256(chunk.code),imports,minimumNodeMajor:24,transport:'stdio'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=await buildBrowserConnector();console.log('Standalone browser connector: '+result.bytes+' bytes / '+result.sha256);}
