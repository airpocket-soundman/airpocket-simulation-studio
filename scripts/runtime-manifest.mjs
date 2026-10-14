import {createHash} from 'node:crypto';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateRuntimeManifest(m){
 const required=['index.html','development.html','progress.json','coi-serviceworker.js','fem-kernel.wasm','gmsh/gmsh.mjs','gmsh/gmsh-core.mjs','gmsh/gmsh-core.wasm','gmsh/gmsh-descriptor.mjs','gmsh/runtime.mjs','mfem/mfem.mjs','mfem/mfem.wasm','cad/occt-import-js.js','cad/occt-import-js.wasm'];
 if(m?.schema!==1||typeof m.version!=='string'||typeof m.revision!=='string'||!/^\d+\.\d+\.\d+$/.test(m.version)||!/^[a-f0-9]{40}$/.test(m.revision)||typeof m.dirty!=='boolean'||!m.files||typeof m.files!=='object'||Array.isArray(m.files))throw Error('Invalid runtime manifest');
 const pairs=Object.entries(m.files);if(pairs.length>100||pairs.reduce((s,[,v])=>s+(v?.bytes||0),0)>150e6)throw Error('Runtime manifest size limit');
 for(const [path,record]of pairs)if(!/^(?:(?:assets|gmsh|mfem|cad)\/[\w.-]+\.(?:mjs|js|wasm|css)|index\.html|development\.html|progress\.json|coi-serviceworker\.js|fem-kernel\.wasm)$/.test(path)||!Number.isInteger(record?.bytes)||record.bytes<=0||record.bytes>80e6||typeof record.sha256!=='string'||!/^[a-f0-9]{64}$/.test(record.sha256))throw Error('Invalid runtime asset path, size or checksum');
 if(typeof m.runtime?.analysisWorker!=='string'||typeof m.runtime?.cadWorker!=='string'||!/^assets\/analysis\.worker-[\w-]+\.js$/.test(m.runtime?.analysisWorker)||!/^assets\/cad\.worker-[\w-]+\.js$/.test(m.runtime?.cadWorker))throw Error('Invalid runtime worker paths');
 for(const path of [...required,m.runtime.analysisWorker,m.runtime.cadWorker])if(!m.files[path])throw Error('Missing runtime asset '+path);
 if(Object.hasOwn(m,'connector')){
  const c=m.connector;if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).length!==3||!['path','minimumNodeMajor','transport'].every(key=>Object.hasOwn(c,key))||c.path!=='assets/studio-browser-mcp.mjs'||c.minimumNodeMajor!==24||c.transport!=='stdio'||!m.files[c.path])throw Error('Invalid standalone browser connector metadata');
 }
 return m;
}
