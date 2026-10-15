import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractsDir = path.join(root, 'src/contracts');
const declarations = readdirSync(contractsDir)
  .filter(name => name.endsWith('.d.ts'))
  .map(name => path.join(contractsDir, name));
const fixture = path.join(root, 'tests/fixtures/contracts-types.ts');
const compiler = path.join(root, 'node_modules/typescript/bin/tsc');
const result = spawnSync(process.execPath, [compiler,
  '--strict', '--noEmit', '--skipLibCheck', 'false', '--target', 'ES2022',
  '--module', 'ESNext', '--moduleResolution', 'Bundler', '--types', '',
  ...declarations, fixture,
], {cwd: root, encoding: 'utf8'});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exitCode = 1;
} else if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  process.stdout.write(`Contract declarations type-check (${declarations.length} declaration files).\n`);
}
