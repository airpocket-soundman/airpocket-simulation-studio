import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops

archive = Path(sys.argv[1] if len(sys.argv) > 1 else '.qa/review51/artifact.gif')
manifest_path = Path(sys.argv[2] if len(sys.argv) > 2 else '.qa/review51/export-summary.json')
out_dir = archive.parent
summary = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest = (summary.get('success', {}).get('artifact', {}).get('manifest')
            or summary['status']['artifact']['manifest'])
image = Image.open(archive)
frames = []
for index in range(getattr(image, 'n_frames', 1)):
    image.seek(index)
    frame = image.convert('RGBA')
    frame.load()
    frames.append({
        'index': index,
        'durationMs': image.info.get('duration'),
        'width': frame.width,
        'height': frame.height,
        'pixelSha256': hashlib.sha256(frame.tobytes()).hexdigest(),
        'bytes': len(frame.tobytes()),
    })
    if index in (0, 12, 23):
        frame.save(out_dir / f'frame-{index:04d}.png')
result = {
    'archive': str(archive),
    'bytes': archive.stat().st_size,
    'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'format': image.format,
    'width': image.width,
    'height': image.height,
    'frameCount': len(frames),
    'loop': image.info.get('loop'),
    'frames': frames,
    'checks': {},
}
result['checks']['gifHeader'] = image.format == 'GIF'
result['checks']['dimensions'] = (image.width, image.height) == (640, 320)
result['checks']['allFrames640x320'] = all((frame['width'], frame['height']) == (640, 320) for frame in frames)
result['checks']['frameCount'] = len(frames) == 24 == manifest['comparison']['gifAnimation']['frames']
result['checks']['loop'] = image.info.get('loop') == 0
result['checks']['delayMs'] = [frame['durationMs'] for frame in frames]
result['checks']['delayCentiseconds'] = [round(frame['durationMs'] / 10) if frame['durationMs'] is not None else None for frame in frames]
result['checks']['manifestDelayCentiseconds'] = manifest['time']['delayCentiseconds']
result['checks']['delaysMatchManifest'] = result['checks']['delayCentiseconds'] == manifest['time']['delayCentiseconds']
result['checks']['totalDurationMs'] = sum(frame['durationMs'] or 0 for frame in frames)
result['checks']['totalDurationMatchesTwoSeconds'] = result['checks']['totalDurationMs'] == 2000
result['checks']['allFrames640x320'] = all((frame['width'], frame['height']) == (640, 320) for frame in frames)
result['checks']['pixelHashes'] = [frame['pixelSha256'] for frame in frames]
result['checks']['allFramesDifferFromPrevious'] = all(
    frames[index - 1]['pixelSha256'] != frames[index]['pixelSha256'] for index in range(1, len(frames))
)
# The comparison layout is two 320x320 panels. Compare the same panel point at start/mid/end.
for index in (0, 12, 23):
    image.seek(index)
    frame = image.convert('RGBA')
    left = frame.crop((0, 0, 320, 320))
    right = frame.crop((320, 0, 640, 320))
    result['checks'][f'frame{index}PanelHashes'] = {
        'left': hashlib.sha256(left.tobytes()).hexdigest(),
        'right': hashlib.sha256(right.tobytes()).hexdigest(),
        'panelsDiffer': hashlib.sha256(left.tobytes()).digest() != hashlib.sha256(right.tobytes()).digest(),
    }
image.seek(0)
first = image.convert('RGBA')
for index in (12, 23):
    image.seek(index)
    frame = image.convert('RGBA')
    diff = ImageChops.difference(first, frame)
    diff_bytes = diff.tobytes()
    changed = sum(1 for offset in range(0, len(diff_bytes), 4) if diff_bytes[offset:offset + 4] != b'\0\0\0\0')
    result['checks'][f'pixelDiffFrame0To{index}'] = {'changedPixels': changed, 'totalPixels': frame.width * frame.height}
result['checks']['manifestDurationSeconds'] = manifest['time']['durationSeconds']
result['checks']['manifestTimeBasis'] = manifest['time']['timeBasis']
result['checks']['manifestFrameSelection'] = manifest['time']['frameSelection']
result['checks']['manifestCamera'] = manifest['time']['camera']
result['checks']['manifestPhasePolicy'] = manifest['time']['phasePolicy']
result['checks']['manifestLoop'] = manifest['time']['loop']
print(json.dumps(result, ensure_ascii=False, indent=2))
