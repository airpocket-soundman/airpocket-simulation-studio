import {readFile,readdir,lstat} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {createRuntimeIdentity} from '../src/runtime-identity.js';

const execute=promisify(execFile),defaultRoot=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const rootFiles=['package.json','package-lock.json','vite.config.js','index.html','development.html'];
const sourceExtension=/\.(?:js|mjs|cjs|json|html|css|cpp|c|h|hpp|wat|cmake|py|wgsl|glsl|rs|sh|ps1)$/;
const skip=name=>name.startsWith('.')||['node_modules','dist','build','coverage'].includes(name)||/\.generated\./.test(name)||name==='runtime-manifest.json';
/** Hash local source and the dependency lock snapshot at collection time.
 * This is source identity, not a dist manifest or proof of loaded asset bytes.
 * No identity file is written, so the digest cannot include its generated self. */
export async function collectSourceBuildIdentity({root=defaultRoot}={}){
 try{
  if(typeof root!=='string'||!root)throw Error('Invalid source root');root=resolve(root);
  const git=async args=>(await execute('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:2000000})).stdout.trim();
  const revision=await git(['rev-parse','HEAD']);if(!/^[a-f0-9]{40}$/.test(revision))throw Error('Missing source revision');
  const files=[];
  async function walk(directory){for(const item of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){if(skip(item.name))continue;const path=resolve(directory,item.name);if(item.isSymbolicLink())throw Error('Source symlinks are unsupported');if(item.isDirectory())await walk(path);else if(item.isFile()&&(sourceExtension.test(item.name)||item.name==='CMakeLists.txt'))files.push(path);}}
  for(const directory of ['src','scripts','native']){const path=resolve(root,directory);try{await walk(path);}catch(error){if(error.code!=='ENOENT')throw error;}}
  for(const name of rootFiles){const path=resolve(root,name);try{if((await lstat(path)).isSymbolicLink())throw Error('Source symlinks are unsupported');files.push(path);}catch(error){if(error.code!=='ENOENT'||['package.json','package-lock.json'].includes(name))throw error;}}
  if(files.length>10000)throw Error('Source file limit exceeded');
  const records=[];let total=0,pkg;
  for(const path of files.sort()){
   const before=await lstat(path);if(!before.isFile()||before.size>20000000||(total+=before.size)>200000000)throw Error('Source byte limit exceeded');
   const bytes=await readFile(path),after=await lstat(path);if(bytes.length!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('Source changed during collection');
   records.push({path:relative(root,path).split(sep).join('/'),bytes:bytes.length,sha256:hash(bytes)});
   if(path===resolve(root,'package.json'))pkg=JSON.parse(bytes.toString('utf8'));
  }
  if(await git(['rev-parse','HEAD'])!==revision)throw Error('Source revision changed during collection');
  const dirty=!!await git(['status','--porcelain','--untracked-files=normal']);
  return createRuntimeIdentity({target:'node',isolation:'worker-thread',build:{status:'available',version:pkg.version,revision,dirty,sourceFingerprint:'sha256:'+hash(JSON.stringify(records))}}).build;
 }catch{return {status:'unavailable'};}
}
