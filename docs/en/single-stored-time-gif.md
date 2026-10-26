# Single-view stored-time GIF

[日本語](../single-stored-time-gif.md) · [Orbit GIF](single-orbit-gif.md) · [Thermal time WebM](single-view-thermal-fixed-webm.md)

Display stored temperature or instantaneous acoustic pressure, choose Stored time under Save images and animations, then Save GIF. This is a24-frame640×320 RGB332/256-color preview with a fixed camera, legend and actual/requested/offset time caption. Colors are quantized; duration is display time. It does not establish physical integration, interpolation or measurement accuracy.

Sources require2–61 frames and at most64MiB of nodal scalar values. Every frame must match the mesh node count with finite scalars; times are finite, nonnegative and strictly increasing. Supported purposes are transient thermal temperature/degC and acousticTransient instantPressure/Pa. Final-only heat flux, static temperature and deformation/slice GIF are refused. Orbit GIF and stored-time WebM retain their existing paths.

Presentation phase is i/23. The first and last stored physical times are included exactly. Intermediate equally spaced physical requests choose the nearest stored frame; a tie chooses the lower index. Repeated selection is allowed, and not all61 stored frames are promised. No interpolation or new solved times are created. The24-entry manifest records requested/actual/signed actual-minus-requested offsets.

Integer duration1–15 seconds maps to centisecond delays totaling100×seconds. GIF loops infinitely, with32MiB output anda120-second cancellation-request watchdog. Readable canvas and SHA-256 are required, without MediaRecorder or native codecs. Inspect `singleStoredTimeGifExport`, then use existing `startExport` with `format:'gif',animation:'time'` and status/artifact/cancel/release. No methods or permissions are added. `formats.gif`/`singleOrbitGifExport` keep describing orbit support.

A separate private issued-Blob proof binds field/kind/unit, source revision, fixed camera, full time axis,24-frame ledger/delays and exact issued byte SHA. Job dispatch uses the prepared animation rather than guessing from a returned proof. Orbit/thermal/acoustic purposes cannot borrow proofs. Intrinsic typed-array brand, exact issued length and32MiB are checked before copying; bytes are owned before asynchronous hashing. Detached diagnostic proof or a cloned Blob cannot confer issuance.

The scalar history is not cloned per frame. Only bounded time metadata is copied under the existing result lease. Result/field/view/camera/history-reference/time/capture-size changes refuse. Cancel, timeout or error publishes no artifact. Finally restores the original timeView including interpolation, camera, controls and inputs. `executionSettled` reflects actual cleanup, not merely the immediate cancelled state.

[Verification record](../evidence/2026-10-27-single-stored-time-gif.json). An independent GIF/LZW reader checks all24 images and delays; fake-canvas tests cover nonuniform times, ties, endpoints, units, purpose/byte tampering, cancellation, timeout and UI restoration. No real browser export is claimed here; that requires a separate acceptance run.

The watchdog requests cancellation; it does not claim settlement of a still-pending owned yield, Blob read or digest. Cleanup and source/host unlock wait until that operation actually settles. An injected never-settling promise keeps executionSettled false; normal yields use finite timers.
