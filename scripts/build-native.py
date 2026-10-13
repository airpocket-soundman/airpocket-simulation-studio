from pathlib import Path
import os,json,subprocess,shutil
ROOT=Path(__file__).resolve().parents[1]
paths=json.loads((ROOT/'.native-cache/paths.json').read_text(encoding='utf-8'))
sdk=Path(paths['sdk']);mfem=Path(paths['mfem']);build=ROOT/'.native-cache/build-mfem'
env=dict(os.environ)
env['EM_CONFIG']=str(sdk/'.emscripten')
env['PATH']=str(sdk/'upstream/emscripten')+os.pathsep+str(sdk)+os.pathsep+env['PATH']
cmake=shutil.which('cmake');ninja=shutil.which('ninja')
if not cmake or not ninja: raise RuntimeError('CMake and Ninja required')
subprocess.run([cmake,'-S',str(ROOT/'native/mfem-adapter'),'-B',str(build),'-G','Ninja','-DCMAKE_MAKE_PROGRAM='+ninja,'-DCMAKE_BUILD_TYPE=Release','-DCMAKE_TOOLCHAIN_FILE='+str(sdk/'upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake'),'-DMFEM_SOURCE_DIR='+str(mfem),'-DCMAKE_CXX_FLAGS=-fexceptions -msimd128'],check=True,env=env)
subprocess.run([cmake,'--build',str(build),'-j','4','--target','airpocket-mfem'],check=True,env=env)
print('MFEM WASM build complete',flush=True)
