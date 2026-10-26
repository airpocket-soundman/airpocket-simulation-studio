# Single-view visual deformation GIF

[日本語](../single-deformation-gif.md) · [Orbit GIF](single-orbit-gif.md) · [Stored-time GIF](single-stored-time-gif.md)

Display saved linear-elastic displacement or a selected stored modal displacement, choose Deformation cycle (visualization), then Save GIF. Only displacement is supported. Stress, plastic strain, nonlinear/plastic output, thermal and acoustic fields are excluded. No new loads, solved times or dynamic response are computed.

For24 phases i/24, display multiplier is `S*(1-cos(2πi/24))/2`: index0 is0, index12 is the selected peakS, and index23 is a small positive value before the next loop starts at0. There is no duplicated terminal0. This is not signed physical vibration, a frequency-driven period or a load/time history. Camera and saved result/legend values remain fixed; each image labels visual scale and fixed saved displacement or normalized mode number. Scale is not an identified physical amplitude.

Modal output selects one of1–6 stored modes. The selected vector's maximum nodal norm is verified as1 within1e-8 without modifying it; the caption states that this is not response amplitude. Static results have no mode. Magnitudes must agree with vector norms at1e-10 scaled tolerance; values must be finite/nonnegative and displacement nonzero.

The new export-only profile is `0<S<=10000`, at most65536 nodes, and3N displacement entries/1572864 bytes at8 bytes each. Coordinates have the same entry count. Indexed own dense data reads avoid getters, iterators and symbol hooks. Original and peak displayed coordinates must be Float32 finite in every component; intermediate coordinates lie between those endpoints. This does not guarantee camera-frustum visibility. Large visualization scales may move geometry outside the image or through the camera; no automatic fitting occurs. Other modes are not cloned.

Output is24 frames,640×320 RGB332/256 colors, integer1–15 seconds, centisecond delays totaling100×seconds, infinite loop and at most32MiB. `singleDeformationGifExport` reports readable-canvas/SHA-256 support without native codecs. Use existing `startExport(format:'gif',animation:'deformation')` and status/artifact/cancel/release after selecting the view; no permissions are added.

A separate private issued-Blob proof binds purpose/kind/displacement, selected mode, peak scale,24-scale ledger, canonical camera, result revision and exact byte SHA. Different modes/scales and orbit/stored-time proofs cannot borrow it. Intrinsic byte brand, issued size and32MiB are checked before copying; bytes are owned before asynchronous hashing. Detached proof diagnostics cannot confer issuance.

Finally restores camera/up/fov, scale, mode selector and onchange closure, controls/inputs/timeView on completion, refusal or cancellation. A replaced result is not overwritten with stale selection. The120-second watchdog requests cancellation only: pending owned yield/Blob/SHA keeps leases/UI locks and executionSettled false until actual settlement and cleanup. Existing orbit/stored-time GIF and WebM paths remain separate.

[Verification record](../evidence/2026-10-27-single-deformation-gif.json). Independent GIF/LZW decoding checks all24 images/delays/peak. Fake-canvas tests cover real Three finite geometry and scale formula, mode/scale/byte tampering,65536/+1, closure restoration and cancellation during owned work. No real GUI/GIF export or solver was run for this feature here.
