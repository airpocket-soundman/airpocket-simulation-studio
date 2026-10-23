import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('printed measurement inspector exposes a read-only typed API',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--strict','--noEmit','--skipLibCheck','false','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','tests/fixtures/printed-measurement-ui-types.ts'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
