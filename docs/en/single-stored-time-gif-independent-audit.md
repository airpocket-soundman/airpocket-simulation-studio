# Independent ownership audit of stored-time GIF

[日本語](../single-stored-time-gif-independent-audit.md) · [Feature contract](single-stored-time-gif.md)

Frozen owner `1e365866f3ab3017b3b971d54da304644dbf801f` was reviewed read-only and four regressions added. Production source is unchanged. See [record](../evidence/2026-10-27-single-stored-time-gif-independent.json).

Initial324dd7e checked snapshots.length=2 but traversed for-of. A custom iterator yielding62frames produced storedTimes62, terminal index61 and scalarBytes16. The final own-data/indexed implementation refuses that counterexample without invoking its hook. Frame/time/scalar/coordinate getters are not called; named map hooks on ordinary arrays are ignored in favor of actual indexed data.

The ownership regression traverses production jobs→result-preparation handoff→viewer adapter. After capturing stored0s from an initial interpolated2s view, it pauses a quantization yield. Cancellation/watchdog requests, even releasing the job token, keep executionSettled false, all three reservations and controls locked, with the0s view retained. New jobs/preparation and artifacts are refused. Only resolving the owned yield permits restoration to2s and canvas/control release. The real Three camera remains finite.

Another regression pauses SHA after24captures and terminal10s. Cancellation still holds all three layers until the digest actually settles, then restores without publishing an artifact. This checks Promise-chain/renderer reservation, not OS/native-codec resource release or a hard wall-clock bound during JavaScript suspension.

A separate shifted2–48s oracle checks phasei/23, stored times[2,6,48], selection counts[2,11,11], lower tie and exact endpoints/terminal zero offset for both result kinds. Display duration1/15s cannot change physical selection. An initial test assumed exact integer interior times and failed at27.999999999999996; only the interior oracle now admits a16EPS×scale IEEE rounding bound. Endpoints remain exact, and no production code or existing tolerance was relaxed.

Four new tests and110related checks passed with zero failures/skips in12.0989619s, including29declarations/layers/JPEN docs. The real-solve-dependent fixed-frame file was excluded; the owner's missing-WASM preparation failure history remains intact. Additional actual GUI/native-codec/solver/product-export execution is zero. Actual GIF pixels, visible models, publication and parent completion remain unproven.
