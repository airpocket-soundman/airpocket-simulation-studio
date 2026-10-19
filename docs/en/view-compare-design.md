# Synchronized multi-case view design note (VIEWCOMPARE, increment 1)

[日本語](../view-compare-design.md) / Related: [Result viewer and export requirements](result-viewer-direction.md)

The first two increments below are historical records from 2026-10-16. See later additions and [Automation API](automation.md) for current behavior and limitations.

Date: 2026-10-16. Only the pure computation module `src/view-compare-layout.js` (domain layer; no DOM, three.js or case store) and its unit tests are implemented. **No GUI, no PNG/video export and no MCP/API operations exist yet**; the VIEWCOMPARE board task remains open.

## Rules implemented

- `computeSharedRange`: builds a common colour range from the min/max of 2 to 4 cases. Cases with a different field or unit are refused (no shared scale across different quantities). Equal min and max are widened and reported as `padded: true`. The returned `colorRange` has the same shape as the existing view-settings `colorRange`.
- `resolveSharedTime`: given a physical time, picks each case's nearest stored frame. The signed offset in seconds is always returned and cases beyond the tolerance are refused. Cases without a time axis return `timeApplies: false`. No display interpolation.
- `sharedScalars`: validates the deformation scale (>= 0) and load factor once; every panel uses the same value.
- `layoutPanels`: integer rectangles for the output image. Two cases sit left/right, three or four use two columns. A label band sits above each panel and a shared legend band below. Rectangles do not overlap; sizes that are too small are refused.
- `panelLabel`: label lines with case name and conditions (name, value, unit). A condition without a unit is refused (write `1` for dimensionless).
- `planCompareView`: combines the above with one shared camera into a single plan.

## Not implemented / not verified

- Wiring two side-by-side views into the result viewer (`src/main.js`), collecting per-case value ranges, and synchronizing the shared camera.
- PNG/video export (connection to the existing visual-export), progress, cancel and state retention after reload.
- MCP/API layout and export operations, and the GUI operation-correspondence table and tests.
- Real-browser verification. Unit tests use synthetic data only.
- The load factor is only validated; it is not mapped to saved data or used to recompute results.

Next step: an adapter in the viewer collects each case's range and frame times, passes them to this module, and applies the resulting plan to each panel through the existing view-settings API.

## Increment 2: GUI (2026-10-16)

"Compare two cases side by side" below the saved-case list (`#compare-left` `#compare-right` `#compare-time` `#compare-run` `#compare-png`). Each case is drawn in turn with the existing result renderer (`showAnalysis`), copied off-screen and composed left/right on a 2D canvas (`#compare-canvas`). Project input is not changed; the displayed result, colour range and frame are restored afterwards. The shared camera is the current camera, the deformation scale the current input, the quantity the current selection. Each case is drawn once with its automatic range to get min/max, then `computeSharedRange` fixes one range and both are redrawn. Transient acoustics need a shared physical time; the offset to the stored frame is printed in the legend. Labels show case name, mesh size (mm) and headline metrics with units. PNG saves the comparison canvas (a separate path from the viewer's `#view-png`).

Not implemented: video export, MCP/API operations, state retention after reload or cancel. Not verified in a real browser (fake-DOM unit tests only). Modal results are fixed to mode 0.


## Polish (2026-10-16)

From real-browser findings. Each panel legend band now draws a gradient colour bar using the same colormap as the 3D result view (`colormapHsl` in `result-view-api.js`, injected from main.js), with the minimum at the left end and the maximum plus unit at the right (geometry: `legendBars`). The physical time and offset use `formatSeconds` (5 significant digits with us/ms/s units; the signed offset is kept). The panel follows the quantity selected in the result viewer, and a transient pair needs a transient result displayed first, so an explanatory hint line was added (JA/EN). Contracts and computation rules are unchanged.

## Stored-frame comparison for transient heat

Thermal cases with stored temperature frames also select the nearest stored frame to the shared physical time and show its actual time and signed offset in the legend. No interpolation is performed. Time selection applies to temperature only; heat flux belongs to the final result. Numerical `caseCompare` and `studio_compare_cases` references select a temperature frame with explicit `frameIndex`, and deltas require exactly equal stored times. Heat-flux references with `frameIndex` are rejected. Thermal numerical references without `frameIndex` retain the existing final-result behavior. Real-Chrome verification of this addition is pending.


## Browser-local automatic comparison settings (2026-10-17)

Save comparison settings automatically in this browser is off by default. Once enabled, one preset is saved after a successful Show comparison or a valid manual-preset import. It contains portable saved-case content hashes and the field, requested shared time/tolerance, camera and deformation scale. It does not store cases, PNG/WebM bytes or connection tokens. Disabling keeps the candidate and stops subsequent automatic updates. Delete saved comparison settings disables saving and writes a settings-free deletion record.

Reload only announces the available candidate. It does not load cases, apply settings or render a comparison automatically. Load the unchanged cases separately, then choose Restore saved comparison settings. Existing revision checks and a generation guard prevent an older restore from replacing newer user settings while asynchronous work is pending. Missing, ambiguous or changed source hashes refuse restoration while retaining the candidate and current view. Use Show comparison to inspect a restored preset.

Storage is limited to the same browser and origin. It uses a dedicated IndexedDB airpocket-comparison-settings (kv/current), or localStorage airpocket-comparison-settings:current when initial database access is unavailable. An existing localStorage record takes precedence; the selected backend is then pinned for the session. The validated record is limited to 128 KiB. Corruption, quota exhaustion or disabled browser storage is reported in the status area; manual JSON and ordinary comparison operations remain available. Writes are serialized and older asynchronous work cannot overwrite newer settings.

2026-10-17 localhost real-Chrome evidence (small thermal cases): [Automatic comparison settings verification](../evidence/2026-10-17-comparison-settings-persistence-real-chrome.json). Starting disabled, opting in and showing a comparison saved one candidate. An actual page reload retained the enabled choice/candidate without automatically restoring cases, time or a PNG. Separate case reimport with new runtime IDs followed by explicit Restore reproduced the same portable preset, and Show comparison succeeded. Disabling kept the candidate; deletion followed by another actual reload left saving off, no candidate and disabled Restore/Delete buttons. Main viewer/input/cases stayed unchanged after save/restore/disable/delete. Public HTTPS, other browsers/devices and forced IndexedDB/quota/corruption failures in real Chrome remain unverified (failure paths have automated coverage). Automatic case/result storage is out of scope.


## Stored-time comparison WebM (2026-10-17)

Call startCompareExport with format:"webm", animation:"time", startTimeSeconds and endTimeSeconds to advance physical time while fixing the shared camera. Explicit finite endpoints must satisfy 0 <= start < end. seconds is the display-video duration (1–15 s, API default 5 s and GUI default 2 s), separate from physical seconds. Time mode rejects the single-time timeSeconds parameter. Existing PNG and default-orbit behavior is preserved; physical start/end are accepted only for time mode.

Both cases must be transient thermal results with stored temperature frames, or transient acoustic results with stored instantaneous pressure frames. The requested interval must lie inside both histories. Each case selects the nearest stored frame at each requested physical time, with earlier-frame tie breaking. Each rendered view labels the requested time, actual stored times and signed offsets. No interpolation or solving is performed. Static results, absent time axes, mixed result kinds and final-only fields such as heat flux are refused before recording.

Optional toleranceSeconds bounds the worst possible offset over the entire requested interval, not just its endpoints; exceeding it refuses recording. The GUI's stored-time offset tolerance is unlimited when blank. It does not inherit a hidden tolerance from the single-time preset; only the dedicated time-video input applies. One color range covers all selectable stored fields across both cases and the whole interval, and the camera remains fixed. manifest.comparison.timeAnimation records the physical endpoints, stored-selection/no-interpolation policy, whole-interval range basis, selectable counts, maximum offsets and initial/final selections. It is not a list of every encoded frame.

Choose Stored-frame time history in the comparison video's type selector and enter endpoints and an optional tolerance. Existing preview, explicit save, cancellation, restoration and the shared job queue remain in use. Video type/range/dedicated tolerance are not added to portable presets or automatic storage. MediaRecorder remains real-time recording targeting 24 fps without guaranteed counts or smoothness.

2026-10-17 localhost real-Chrome [time-video evidence](../evidence/2026-10-17-comparison-time-video-real-chrome.json), using two small thermal cases: the API recording spans physical 0..10 s over a requested 2 s display duration. Its 27,294-byte VP9 WebM (1280x640) passed SHA-256 validation; external decoding found four frames with four distinct image hashes. Verified the fixed 20..40 degC range/camera, nearest stored-time/offset manifest and out-of-axis/zero-tolerance/heat-flux refusals. GUI creation with blank dedicated tolerance, native preview, cancellation of a 5 s request, restart at 2 s and user playback to completion passed. The original 2.01 s interpolated viewer, input, cases and comparison settings matched exactly after completion/cancel/restart. GUI native playback is separate from external decoding of the API clip. Real-browser acoustic cases, public HTTPS, general geometry, smooth/guaranteed 24 fps and GUI download completion remain unverified.

## Comparison deformation video (visualization multiplier only)

Use animation:"deformation" with startCompareExport WebM. Only two linear-elastic cases with displacement/stress, finite nonzero saved displacements and an explicit positive deformScale are supported. timeSeconds/toleranceSeconds/startTimeSeconds/endTimeSeconds are refused. The GUI Saved displacement scale (one way) uses the same queue. Camera, color range and saved result values remain fixed; only the visualization multiplier changes linearly from zero to the requested scale, one way. This is not physical time, load history or a new solved result. Modal/hyperelastic/plastic/thermal/acoustic/flow cases are excluded. manifest.comparison.deformationAnimation records scale endpoints, scalePolicy:linear, fixed saved result and loadHistory:false. Portable schema and existing orbit/time video behavior are unchanged. 

2026-10-17 localhost real-Chrome [partial verification](../evidence/2026-10-17-comparison-deformation-video-real-chrome.json): two small actual solveElastic cases (3/6 N, visualization scale 200) passed GUI 2 s creation/1280x640 native preview/user playback start, cancellation of a 5 s request and restart at 2 s. All four original states (2.01 s interpolated viewer, input, cases and comparison panel) matched exactly after each of the three paths. Playback completion and playback after restart remain unverified. The first API attempt failed with Comparison export expired; the second was interrupted by exportStatus timeout with browser reconnection/page reset, whose cause is not established. No real-browser API bytes/SHA/manifest, external decode, independent shape-change proof or retained video/image was obtained. Public HTTPS, general geometry, smooth 24 fps and GUI download completion remain unverified. This partial evidence is not full acceptance.

Additional localhost real-Chrome [API artifact/geometry verification](../evidence/2026-10-17-comparison-deformation-video-artifact-real-chrome.json) supplements the earlier partial record. A low-load 2 s request produced 24,858-byte VP9/1280x640 with SHA-256 f2c424a5…; external decoding found four frames/four distinct images. Geometry-only regions excluding labels/legend independently changed, with moved colored bounds under a fixed camera/range 0..0.00312 mm and visual scale 0 to 200. The original 2.01 s interpolation, input, cases and panel matched exactly. A separate GUI clip reached native playback completion at 2.125 s; this is distinct from independent API decoding. Earlier expiry/timeout attempts remain preserved. Public HTTPS, general geometry, smooth/guaranteed 24 fps, physical load response and GUI download completion remain unverified.

The [15 s boundary real-Chrome check](../evidence/2026-10-17-comparison-deformation-video-15s-real-chrome.json) received the start reply in 74 ms and completed at 15,725 ms, beyond the original 15 s deadline. The 92,321-byte VP9/1280x640 passed SHA-256 35ff9912…; external decoding found 17 frames/17 images with geometry-only change and original four-state equality. The admission-command deadline itself was not extended. Real-browser disconnect during this recording was not tested; invalidation/cancellation/source-change guards have separate automated coverage.

## Comparison orbit GIF



2026-10-17 localhost real-Chrome [comparison GIF evidence](../evidence/2026-10-17-comparison-gif-real-chrome.json): API artifact 5,574,849 bytes passed SHA-256 e171333e… validation. External decoding found 640x320, 24 frames/24 images; Pillow verified 80/90 ms delays totaling 2,000 ms and loop0. GUI image preview/cancel/restart passed, each preserving the original 2.01 s interpolated viewer, input, cases and panel exactly. The first connection-reset/timeout attempt is retained without a root-cause claim. Public HTTPS, general geometry, smoothness in other players and GUI download completion remain unverified.

## Comparison GIF time and visualization scale (2026-10-19)

`startCompareExport` accepts `format:"gif"` and `animation:"orbit"|"time"|"deformation"`. No new tool is added:35 default/37 paired MCP tools,91 live operations and the three-tool minimal connector remain. Discover the actual registered schema and `exportCapabilities().comparisonGifExport` first. Single-view `formats.gif` and MP4 remain unsupported.

GIF uses 24 fixed frames,640×320 and lossy 256-color RGB332. Integer seconds 1–15 (API default 5, GUI default 2) distribute integer-centisecond delays totaling `seconds*100`. Orbit retains `i/24`; time/deformation use `i/23`, including both endpoints. Infinite looping does not guarantee player timing or smooth 24fps.

Time requires stored temperature or instantaneous-pressure frames in both cases and explicit `startTimeSeconds < endTimeSeconds` within both axes. Fixed `timeSeconds` and final-only thermal heat flux are refused. Camera and the common color range over every selectable stored frame in the interval remain fixed. Nearest stored frames show actual times and signed offsets without interpolation or new physics. Optional toleranceSeconds is checked over the whole interval.

Deformation requires two linear-elastic displacement/stress results, nonzero saved displacement and a positive explicit deformScale. Physical-time arguments and nonlinear results are refused. Camera, scalar values and range stay fixed; only the visualization multiplier changes linearly from zero to the requested scale. Preserve the manifest's visualizationOnly:true / loadHistory:false and image labels; this is not a physical loading history.

GUI GIF selection preserves the chosen animation. Range/scale requests share the queue, revision/lease guards, cancellation, hashed artifact retrieval and release lifecycle. Success/cancel/error restore the original view; no partial artifact is delivered. [Localhost actual MCP/Chrome evidence](../evidence/2026-10-19-comparison-time-deformation-gif-real-chrome.json) uses small 11-frame thermal and 3N/6N elastic cases: API artifact, external 24-frame decode/total delays, GUI preview/cancel/restart and unchanged input/cases/result/comparison states. Public HTTPS, general geometry and OS download completion remain unverified.
