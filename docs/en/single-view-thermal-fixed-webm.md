# Stored temperature-frame WebM

[日本語](../single-view-thermal-fixed-webm.md)

Export stored transient-thermal temperature frames through Results → Save images and animations → Stored time (acoustic / temperature) → Save WebM video. Select Temperature first. Heat flux is refused without automatically changing the field. Thermal Play preview remains unsupported. Orbit, deformation and section recording are unchanged.

The separate `singleThermalTimeWebmExport` capability advertises support. Existing `singleTimeWebmExport` and Acoustic-named APIs remain acoustic-only. The existing startExport time/WebM route also works; no method or scope is added. A private thermal proof binds kind=`thermal`, field=`temperature`, unit=`degC`, result revision and video-byte SHA. Acoustic getters/manifests cannot borrow it.

Only the stored shape used by framesOf is supported: thermal kind, transient=true, and snapshots[{time,temperature}]. Every frame must contain finite temperatures matching mesh node count. Existing storage limits of 61 frames and 64MiB (nodes×frames×8bytes) are reused; temperature arrays are not copied again. No temperatures are recalculated, no heat flux is inferred and no interpolation is generated.

Video duration is 1–15 seconds with N=min(seconds×24,120), fixed camera and phase=i/(N−1). Nearest stored frames cover both physical endpoints; requested/actual times and signed offsets are recorded. VP8 all-key frames, strict WebM validation, decoding of every timestamp and original Blob byte-SHA binding remain required. Capture fits 1280×640 and video bytes stay within 32MiB. Unsupported codecs or incomplete endpoints refuse without realtime fallback.

Cancellation, result replacement or a field change during export publishes no artifact and restores camera, controls and the prior interpolated time view in finally. Fake codec/UI regressions cover actual JA/EN Save wiring, endpoints, field refusal, proof isolation/tampering, restoration/cancellation and acoustic compatibility. No real browser/codec thermal export has been run; existing acoustic-video evidence is not reused as thermal evidence. Additional solver/GUI/real-codec runs: zero.

The final job boundary requires a thermal proof for prepared temperature and an acoustic proof for instantPressure; every other field is refused. It does not choose the manifest kind from the Blob proof alone. Fake integration regressions reject crossed proofs in both directions even with the same declared revision. Final related tests: 113 passed, zero failures or skips.

Both public encode APIs remain async: invalid, null and undefined inputs reject a Promise instead of throwing synchronously. Valid inputs retain the pre-await snapshot. With this compatibility regression, final related tests total 114 passed.
