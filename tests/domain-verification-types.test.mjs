import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('PRINT2, opening confirmation and limited Tet4 public APIs retain positive and negative type contracts',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--strict','--noEmit','--skipLibCheck','false','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--types','','tests/fixtures/domain-verification-types.ts','tests/fixtures/opening-candidate-cap-types.ts'],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:65536});
 assert.ifError(result.error);assert.equal(result.status,0,(result.stdout+result.stderr).slice(0,65536));
});
