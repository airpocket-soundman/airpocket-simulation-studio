import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checker = path.join(root, 'scripts/check-contract-types.mjs');

test('shared contract declarations pass the real TypeScript compiler', () => {
  const result = spawnSync(process.execPath, [checker], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /type-check/);
  assert.equal(result.stderr, '');
});
