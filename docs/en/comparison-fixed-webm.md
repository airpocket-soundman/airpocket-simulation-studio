# Fixed-frame comparison time WebM

[日本語](../comparison-fixed-webm.md)

Two saved thermal-temperature or transient-acoustic cases requested with format=webm / animation=time use fixed frames including both physical endpoints. No analysis or physical interpolation is performed. Comparison GIF/PNG and realtime orbit/deformation WebM retain their existing paths.

The separate comparisonTimeWebmExport capability requires VideoEncoder, VideoDecoder, VideoFrame, EncodedVideoChunk and codec-support probes. VP8 support is checked at export. Unsupported browsers refuse with a stable reason and GIF guidance, without realtime fallback. Existing MCP comparison export/status/artifact/cancel/release methods remain.

Display seconds are integers1..15. N=min(seconds×24,120):48 frames for2seconds,120 for15seconds, not constant24fps. Physical phase i/(N−1) includes both endpoints while preserving nearest-stored selection, offset tolerance and common colors. Presentation timestamps are round(i×seconds×1e6/N) integer microseconds; durations are successive rounded-boundary differences. The physical endpoint image occupies the last display interval. Intervals sum to the requested duration; physical phase and presentation time are distinct.

Bounds:1280x640,120frames,32MiB artifact/retained encoded data, native queues and submitted-minus-output counts each<=2,120seconds total. All frames are VP8 keyframes; encoder output must exactly match submitted timestamps with no duplicates/missing frames, followed by flush. Every input/decoded VideoFrame is closed.

Pure fixed-webm.js writes a deliberately limited WebM and a strict reader checks it: finite EBML sizes, single VP8 video track, no audio/lacing/encryption, one SimpleBlock per Cluster with relative time0. TimestampScale1000ns makes Cluster timestamps integer microseconds. Info Duration and DefaultDuration are explicit. DefaultDuration is nominal (the first interval's nanoseconds), distinct from rounded adjacent presentation differences (which may vary by1microsecond) and total Duration.

Container flags/declared dimensions do not prove codec payload validity. The application's VideoDecoder verifies all strict-demuxed timestamps, decoded dimensions and terminal output before returning the Blob. The job layer checks the container/proof/physical-selection ledger before publication. Manifests report recording=fixed-frame, realtime=false, frame count, presentation schedule, verification and each panel's stored physical time/offset.

Hidden pages,5second progress stalls, abort, disconnect, stale sources, codec/container errors and unverified endpoints never publish a completed artifact. Timers/codecs/frames/host locks are cleaned up.32MiB is not peak RAM: temporary container copies and codec internals are additional memory. Reasons include WEBM_FIXED_UNSUPPORTED/INVALID/CODEC_FAILURE/OUTPUT_MISMATCH/CANCELLED/TIMEOUT and WEBM_ENDPOINT_UNVERIFIED.

Tests cover codec fakes, strict container negatives and the real adapter/queue with uneven time axes. Fake codecs do not prove VP8 pixels. Independent FFmpeg fixture evidence and a newly budgeted browser fixed-path export are separate follow-ups. The [historical partial MediaRecorder recording](../evidence/2026-10-24-acoustic-time-webm/README.md) is unchanged. Similar captureStream/150ms logic remains in single-view time; only comparison loss was observed, so single-view loss is inferred risk, not reproduced. Orbit/deformation remain realtime without new terminal guarantees. General geometry/physical accuracy, publicHTTPS, MP4 and other engines remain open.

Primary sources: [WebCodecs Working Draft](https://www.w3.org/TR/webcodecs/), [WebM Container Guidelines](https://www.webmproject.org/docs/container/) and [RFC9559](https://www.rfc-editor.org/rfc/rfc9559.html). The [canvas capture draft](https://w3c.github.io/mediacapture-fromelement/) makes requestFrame a paint-time request, not an encoder acknowledgement. This bounded profile is not general Matroska or all-codec support.
