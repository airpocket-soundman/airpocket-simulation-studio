import hashlib
import io
import json
import sys
import zipfile
import zlib
from pathlib import Path

from PIL import Image, ImageChops

archive = Path(sys.argv[1] if len(sys.argv) > 1 else '.qa/review50/artifact.zip')
raw = archive.read_bytes()
z = zipfile.ZipFile(archive)
result = {
    'archive': str(archive),
    'bytes': len(raw),
    'sha256': hashlib.sha256(raw).hexdigest(),
    'entries': [
        {'name': i.filename, 'bytes': i.file_size, 'crc32': f'{i.CRC:08x}', 'compression': i.compress_type}
        for i in z.infolist()
    ],
    'checks': {},
}
manifest = json.loads(z.read('manifest.json'))
result['manifest'] = manifest
result['frames'] = []
images = []
for entry in manifest.get('frames', []):
    name = entry.get('file') or entry.get('path') or entry.get('name')
    if not name:
        continue
    data = z.read(name)
    info = z.getinfo(name)
    actual_crc = zlib.crc32(data) & 0xffffffff
    image = Image.open(io.BytesIO(data))
    image.load()
    rgba = image.convert('RGBA')
    images.append(rgba)
    result['frames'].append({
        **entry,
        'decoded': {
            'width': image.width,
            'height': image.height,
            'mode': image.mode,
            'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest(),
            'pixelSha256': hashlib.sha256(rgba.tobytes()).hexdigest(),
            'crc32': f'{actual_crc:08x}',
            'crc32MatchesEntry': actual_crc == info.CRC,
        },
    })
result['checks']['manifestEntrySha256'] = hashlib.sha256(z.read('manifest.json')).hexdigest()
result['checks']['manifestHasNoSelfHash'] = 'sha256' not in manifest
result['checks']['allFrameHashesMatchManifest'] = all(
    f['decoded']['sha256'] == str(f.get('sha256', '')).removeprefix('sha256:') for f in result['frames']
)
result['checks']['allFrameCrcMatchZipEntry'] = all(f['decoded']['crc32MatchesEntry'] for f in result['frames'])
result['checks']['allFramesDecoded'] = len(images) == manifest.get('frameCount') and len(images) > 0
result['checks']['allFrameDimensionsMatchManifest'] = all(
    (f['decoded']['width'], f['decoded']['height'])
    == (manifest['resolution']['width'], manifest['resolution']['height'])
    for f in result['frames']
)
result['checks']['allFramePixelsDiffer'] = all(
    hashlib.sha256(images[i].tobytes()).digest() != hashlib.sha256(images[i + 1].tobytes()).digest()
    for i in range(len(images) - 1)
)
result['checks']['phases'] = [f.get('phase') for f in result['frames']]
result['checks']['slicePositionsMm'] = [f.get('slicePosition') for f in result['frames']]
result['checks']['allFramesMatchManifestPhaseSlice'] = (
    result['checks']['phases'] == [0, 0.5, 1]
    and result['checks']['slicePositionsMm'] == [0, 5, 10]
)
if images:
    base = images[0]
    result['checks']['pixelDiffToFirst'] = []
    for i, image in enumerate(images[1:], start=1):
        diff = ImageChops.difference(base, image)
        diff_bytes = diff.tobytes()
        changed = sum(1 for offset in range(0, len(diff_bytes), 4) if diff_bytes[offset:offset + 4] != b'\0\0\0\0')
        result['checks']['pixelDiffToFirst'].append({'frame': i, 'changedPixels': changed, 'totalPixels': base.width * base.height})
print(json.dumps(result, ensure_ascii=False, indent=2))
