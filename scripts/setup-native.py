from pathlib import Path
import urllib.request, zipfile, tarfile, subprocess, sys, json
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.native-cache'
CACHE.mkdir(exist_ok=True)
SDK_COMMIT='35ff8a6d150541276abbc6bae512ca90bcfbe220'
MFEM_COMMIT='16b0b814a3ba15a56c7a04e02d047188800cc0bf'
SDK_VERSION='6.0.12'
def download(url,path):
    if not path.exists():
        print('Downloading '+path.name,flush=True)
        urllib.request.urlretrieve(url,path)
    return path
sdk=CACHE/('emsdk-'+SDK_COMMIT)
if not sdk.exists():
    archive=download('https://codeload.github.com/emscripten-core/emsdk/zip/'+SDK_COMMIT,CACHE/'emsdk.zip')
    with zipfile.ZipFile(archive) as f:
        for name in f.namelist():
            if not (CACHE/ name).resolve().is_relative_to(CACHE.resolve()): raise RuntimeError('Unsafe archive path')
        f.extractall(CACHE)
mfem=CACHE/('mfem-'+MFEM_COMMIT)
if not mfem.exists():
    archive=download('https://codeload.github.com/mfem/mfem/tar.gz/'+MFEM_COMMIT,CACHE/'mfem.tar.gz')
    with tarfile.open(archive) as f: f.extractall(CACHE,filter='data')
subprocess.run([sys.executable,str(sdk/'emsdk.py'),'install',SDK_VERSION],check=True,cwd=sdk)
subprocess.run([sys.executable,str(sdk/'emsdk.py'),'activate',SDK_VERSION,'--embedded'],check=True,cwd=sdk)
(CACHE/'paths.json').write_text(json.dumps({'sdk':str(sdk),'mfem':str(mfem),'version':SDK_VERSION}),encoding='utf-8')
print('Native toolchain ready',flush=True)
