import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('single-view acoustic fixed WebM public runtime types preserve bounded physical plan and immutable output',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--strict','--noEmit','--skipLibCheck','false','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','tests/fixtures/single-view-time-webm-types.ts'],{encoding:'utf8',timeout:30000,windowsHide:true});assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
});
