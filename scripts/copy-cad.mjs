import { mkdir, copyFile, readdir } from 'node:fs/promises';
await mkdir('public/cad', {recursive:true});
await copyFile('src/progress.json','public/progress.json');
for (const name of ['occt-import-js.js','occt-import-js.wasm']) await copyFile(`node_modules/occt-import-js/dist/${name}`, `public/cad/${name}`);
await mkdir('public/licenses',{recursive:true});
for(const pkg of ['three','occt-import-js']) {
 const files=await readdir(`node_modules/${pkg}`);
 const license=files.find(n=>/^license/i.test(n));
 if(!license) throw Error(`Missing license: ${pkg}`);
 await copyFile(`node_modules/${pkg}/${license}`,`public/licenses/${pkg}.txt`);
}
