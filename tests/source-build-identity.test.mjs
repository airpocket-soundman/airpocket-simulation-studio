import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {collectSourceBuildIdentity} from '../scripts/source-build-identity.mjs';
test('source identity hashes actual local code and dependency lock bytes while excluding generated output and dist',async()=>{
 const root=await mkdtemp(join(tmpdir(),'source-identity-'));const git=args=>execFileSync('git',args,{cwd:root,windowsHide:true,stdio:'pipe'});
 try{
  for(const directory of ['src','scripts','dist','node_modules','native'])await mkdir(join(root,directory));
  await writeFile(join(root,'package.json'),JSON.stringify({version:'1.2.3'}));await writeFile(join(root,'package-lock.json'),'{}');await writeFile(join(root,'src','core.js'),'export const n=1;');await writeFile(join(root,'scripts','build.mjs'),'// build');await writeFile(join(root,'.gitignore'),'dist/\nnode_modules/\n*.generated.json\n');
  git(['init']);git(['add','.']);git(['-c','user.name=Identity Test','-c','user.email=identity@example.invalid','commit','-m','fixture']);
  const first=await collectSourceBuildIdentity({root});assert.equal(first.status,'available');assert.equal(first.version,'1.2.3');assert.equal(first.dirty,false);assert.match(first.revision,/^[a-f0-9]{40}$/);assert.match(first.sourceFingerprint,/^sha256:[a-f0-9]{64}$/);
  await writeFile(join(root,'dist','runtime-manifest.json'),'old-dist');await writeFile(join(root,'node_modules','runtime.js'),'dependency cache');await writeFile(join(root,'src','identity.generated.json'),'generated');
  assert.deepEqual(await collectSourceBuildIdentity({root}),first);
  await writeFile(join(root,'src','core.js'),'export const n=2;');const changed=await collectSourceBuildIdentity({root});assert.equal(changed.dirty,true);assert.notEqual(changed.sourceFingerprint,first.sourceFingerprint);assert.equal(changed.revision,first.revision);
  await writeFile(join(root,'package-lock.json'),' {"version":2}');assert.notEqual((await collectSourceBuildIdentity({root})).sourceFingerprint,changed.sourceFingerprint);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('no git checkout or missing dependency snapshot reports unavailable instead of borrowing runtime/dist metadata',async()=>{
 const root=await mkdtemp(join(tmpdir(),'identity-unavailable-'));try{await writeFile(join(root,'package.json'),'{"version":"9.9.9"}');assert.deepEqual(await collectSourceBuildIdentity({root}),{status:'unavailable'});assert.deepEqual(await collectSourceBuildIdentity({root:join(root,'missing')}),{status:'unavailable'});}finally{await rm(root,{recursive:true,force:true});}
});
