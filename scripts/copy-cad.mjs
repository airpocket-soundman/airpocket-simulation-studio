import { mkdir, copyFile, readdir } from 'node:fs/promises';
await mkdir('public/cad', {recursive:true});
await copyFile('src/progress.json','public/progress.json');
for (const name of ['occt-import-js.js','occt-import-js.wasm']) await copyFile(`node_modules/occt-import-js/dist/${name}`, `public/cad/${name}`);
await mkdir('public/gmsh',{recursive:true});
for(const name of await readdir('node_modules/@loumalouomega/gmsh-wasm/dist'))if(/\.(mjs|wasm)$/.test(name))await copyFile('node_modules/@loumalouomega/gmsh-wasm/dist/'+name,'public/gmsh/'+name);
await copyFile('node_modules/coi-serviceworker/coi-serviceworker.js','public/coi-serviceworker.js');
await mkdir('public/licenses',{recursive:true});
for(const pkg of ['three','occt-import-js','@loumalouomega/gmsh-wasm','coi-serviceworker']) {
 const files=await readdir(`node_modules/${pkg}`);
 const license=files.find(n=>/^license/i.test(n));
 if(!license) throw Error(`Missing license: ${pkg}`);
 await copyFile(`node_modules/${pkg}/${license}`,`public/licenses/${pkg.replaceAll('/','-')}.txt`);
}
