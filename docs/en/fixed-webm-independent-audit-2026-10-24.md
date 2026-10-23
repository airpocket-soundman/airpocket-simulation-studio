# Independent fixed-frame WebM container audit (2026-10-24)

[日本語](../fixed-webm-independent-audit-2026-10-24.md)

Based on owner commit `56f7a25f6ff9b08e24fc6183552a4c5703717c2e`, three independent tests and external ffmpeg/ffprobe proof were added without reusing production numerical/EBML helpers. The [summary JSON](../evidence/2026-10-24-fixed-webm-independent-audit.json) retains raw bytes/SHA. No actual-browser export or solver ran; root's browser checks are not anticipated here.

Existing ffmpeg libvpx produced16×16/24fps/all-key frames, first12red and final12blue. Independently parsed IVF payloads passed through the target mux into an [1888-byte WebM](../evidence/fixed-webm-independent-20261024/red-blue-own-mux.webm). External ffprobe found24key packets, exact PTS round(i×1,000,000/24) microseconds and1.000000second duration. External ffmpeg decoded24images with different first/last MD5 and terminal blue retained. This is bounded container/codec evidence, not physical analysis or browser playback proof.

The independent tests use BigInt rational rounding across all15second settings, both physical phase endpoints and exact presentation span. They verify external IVF keyframe headers/dimensions/payloads and the known container SHA; all1888prefix truncations refuse. An independent EBML walk mutates unknown size, NaN Duration, TimestampScale, track, relative timestamp, lacing and zero width; each refuses.

## Finding and final identity

Before the fix, an ordinary Uint8Array backed by SharedArrayBuffer with an own ordinary-ArrayBuffer `buffer` value passed demux with24packets. Owner switched to intrinsic TypedArray buffer/byteLength access, ArrayBuffer brand checking and intrinsic copying. Spoofed shared input now refuses; own accessor calls remain zero. The full pre-fix source hash was not captured, so only the observed reproducer/vulnerable fragment are recorded. The own iterator was not invoked and is not claimed as a defect.

Audited owner working CRLF SHA was `0e6ef2640315477a81a03915924d8e5b620a883de095de2b5d9ef961f90d952b`. Normalizing only CRLF to LF matches final Git-blob SHA `6e44da80bdc5c8387601868c2233e5c623df95641bf9a8a635acdcf7488b6119`. No production source was changed by this audit.

## Standards and limits

Primary references were [EBML RFC8794](https://www.rfc-editor.org/rfc/rfc8794.html), [Matroska RFC9559](https://www.rfc-editor.org/rfc/rfc9559.html), [WebM profile](https://www.webmproject.org/docs/container/) and the [WebCodecs draft](https://www.w3.org/TR/2026/WD-webcodecs-20261019/). VINT/finite parent boundaries, timestamp units, key/lacing flags and codec responsibilities are distinct.

DefaultDuration is nominal, based on the first interval; quantized PTS differences41666/41667microseconds and overall Segment duration are separate. An external41667microsecond packet duration is not claimed as every exact interval. Pure demux validates this producer's narrow container profile; real VP8 payload validity and decoded dimensions/timestamp collection belong to the full decoder pipeline. This is not a general WebM parser, smooth real-time24fps proof or resolution of the historical MediaRecorder partial artifact.

Reproduce the external source with existing ffmpeg lavfi red16×16/24fps/1second, a full-canvas blue drawbox enabled at n>=12, libvpx/g=1/yuv420p and IVF output; the exact command is in the Japanese counterpart. No new software, progress or parent-acceptance change was made.
