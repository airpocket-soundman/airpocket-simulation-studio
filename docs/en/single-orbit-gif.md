# Single-view orbit GIF

[日本語](../single-orbit-gif.md) · [Export specification](visual-export.md)

Display a computed or saved result and choose its field, time, mode and color range. Under Save images and animations, select Orbit the model and press Save GIF. Only the camera moves; the selected result stays fixed. Deformation/slice GIF are refused; stored-time GIF uses the separate [stored-time capability](single-stored-time-gif.md). Existing PNG/WebM and two-case comparison GIF remain separate.

Discover support through singleOrbitGifExport or formats.gif. A readable 2D canvas and SHA-256 are required; MediaRecorder/native codecs are not. The existing startExport accepts format:'gif', animation:'orbit', seconds:1..15, with exact expectedResultRevision from getResultView. Methods/scopes are unchanged. Use existing status/artifact pages/cancel/release.

The fixed 24 frames use phase=i/24 without a repeated full-turn endpoint. Positive integer-centisecond delays sum to seconds×100. Output is looping GIF89a/RGB332/256 colors, 640×320, capped at 32MiB. GIF-only capture fits the source image without aspect distortion into the top 204px and keeps the bottom 116px caption at full 640px width. Default PNG/WebM capture is unchanged. A source viewport/capture resize refuses output. This lossy preview does not guarantee smooth 24fps, numerical precision or peak process memory.

A private issued-Blob proof binds the 24 camera/delay/letterbox records, field, camera, resultRevision, selected time/mode and original whole-byte SHA. Before copying, manifest validation checks intrinsic Uint8Array/ArrayBuffer brands, nonshared storage and exact issued length within 32MiB. Cloned/comparison Blobs, changed bytes and wrong prepared field/time/camera/mode are refused. Null/undefined both mean no mode and differ from mode0. No proof persistence/reload is provided.

A fixed interpolated 2s view records selectedPhysicalTimeSeconds:2, interpolated:true and timeSelectionBasis:'viewer-interpolated'; its caption identifies an interpolated view. An internal slider at stored frame 0 does not mean frame 0's temperature is displayed. Interpolated output omits selectedStoredFrameIndex; static/modal fields receive no invented history.

Same-revision field/time/range/layer/clip/mode changes, source replacement and camera up/fov changes refuse output. Finally restores up before lookAt/projection, the mode onchange closure, time/inputs and locks. Cancellation is cooperative: unresolved yields are not abandoned by a race. The renderer remains reserved until executionSettled; partial GIFs are never published.

## Initial record (2026-10-27, before actual export)

An independent GIF/LZW decoder checks 24 images, total delays, palette and letterbox pixels. JA/EN fakeUI checks actual Save wiring/API byte equality, interpolated 2s, refusal/restoration for field/time/range/resize/mode closure/up/fov. Real GUI/GIF export and browser download need a separate budget and remain unexecuted here. Five slice-reference tests in an initial 132-test batch failed preparation because prebuilt WASM was absent; no solve started. All 125 fake-focused tests passed, with no WASM fetch or solver retry. See [evidence](../evidence/2026-10-27-single-orbit-gif.json).


## Current bounded real-main verification (2026-10-27, 202c)

At frozen runtime `4e0f785de1971a2a40b89db6c04a8fe5035818de`, the ordinary foreground English main/IAB exported one two-second orbit GIF through formal stdio from the existing synthetic 94-node thermal box at an interpolated 2s view. See [visible success evidence](../evidence/2026-10-27-single-orbit-gif-visible-main/README.md). Checks covered 5574849 bytes/SHA, 24 frames, 640×320, 200cs total delay, infinite loop (loop value 0), archive/result identity, every camera/phase and the fixed interpolated 2s selection. Independent LZW and FFmpeg outputs match every RGB pixel; all 24 model regions contain 2785–5163 nonbackground pixels and 24 distinct ROI hashes. First/middle/last images visibly show the complete box, changing orientation, legend and interpolated time. Five-state restoration, settled release and session/child/token cleanup were verified.

The [initial 202 final-job refusal](../evidence/2026-10-27-single-orbit-gif-failed/README.md) and [202b background-only partial result](../evidence/2026-10-27-single-orbit-gif-main/README.md) remain separate historical failures. See [camera correction history](single-orbit-gif-camera-identity-fix.md). The initial unexecuted record describes its dated state. This bounded success proves display of the synthetic box, not general geometry, material calibration, physics accuracy, other languages/engines/background/cancellation matrices, public HTTPS or GUI-button download completion. Parent acceptance and progress statuses are unchanged.

See [stored-time GIF](single-stored-time-gif.md) for the separate time path.
