"""Reproduce the optional C++ CLI development check using existing caches only."""
from pathlib import Path
import json
import os
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
paths_file = ROOT / '.native-cache/paths.json'
if not paths_file.is_file():
    raise SystemExit('Existing .native-cache/paths.json required; no downloads are performed.')
paths = json.loads(paths_file.read_text(encoding='utf-8'))
sdk = Path(paths['sdk'])
build = ROOT / '.native-cache/build-mfem/mfem-core'
compiler = sdk / ('upstream/emscripten/em++.exe' if os.name == 'nt' else 'upstream/emscripten/em++')
library = build / 'libmfem.a'
for required in (compiler, library, build / 'mfem.hpp'):
    if not required.is_file():
        raise SystemExit(f'Existing cache file required: {required}; no downloads are performed.')
node = shutil.which('node')
if not node:
    raise SystemExit('Node.js required.')
output = ROOT / '.native-cache/native-proof-wasm.cjs'
env = dict(os.environ)
env['EM_CONFIG'] = str(sdk / '.emscripten')
command = [str(compiler), '-std=c++17', '-fexceptions', '-msimd128', '-I' + str(build),
           str(ROOT / 'native/native-proof/main.cpp'), str(ROOT / 'native/mfem-adapter/adapter.cpp'),
           str(library), '-sENVIRONMENT=node', '-sEXIT_RUNTIME=1', '-sMODULARIZE=0',
           '-sEXPORT_ES6=0', '-sALLOW_MEMORY_GROWTH=1', '-sSTACK_SIZE=5242880', '-o', str(output)]
subprocess.run(command, cwd=ROOT, env=env, check=True)
env['AIRPOCKET_NATIVE_PROOF'] = str(output)
print('Running WASM development verification; this is not host-native execution.', flush=True)
subprocess.run([node, '--test', 'tests/native-proof.test.mjs'], cwd=ROOT, env=env, check=True)
