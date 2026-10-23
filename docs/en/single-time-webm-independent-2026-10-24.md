# Independent audit of single-view acoustic time WebM

[日本語](../single-time-webm-independent-2026-10-24.md)

The audit fixes owner commit `12ab81b842d5d91c39acf926d7d7d38bd8db4cc0`. A draft counterexample substituted different packet bytes with the same schedule and dimensions while borrowing the original Blob decoder proof. The owner bound the original intrinsic Blob read SHA to the private proof, compared manifest and job hashes, and refused an overridden arrayBuffer reader. The independent counterexample now rejects with `WEBM_ENDPOINT_UNVERIFIED`.

Three independent regressions cover all 15 durations using a nonzero, nonuniform physical axis, own BigInt presentation rounding and direct distance searches; first/last/offset identity; altered payload, cloned Blob, detached-proof and iterator forgery; abort during a pending codec probe and harmless late settlement. Together with related UI regressions, 33 tests passed with zero failures or skips. JA/EN 4K capture bounds, interpolated-view restoration, abort/result replacement/GUI stop and preview compatibility were also checked.

There were zero additional real codec runs, exports or solvers. Fake codec success does not establish actual VP8 pixel content. Existing real comparison-video evidence is separate; no new single-view main export is claimed. Thermal WebM, generated interpolation and physical-accuracy acceptance remain outside scope. executionSettled does not prove OS resource teardown. Progress statuses are unchanged.

Replay: `node --test tests/single-view-time-webm-independent.test.mjs tests/single-view-time-webm.test.mjs tests/visual-export-adapter.test.mjs`. The [evidence JSON](../evidence/2026-10-24-single-time-webm-independent.json) records fixed source SHA values separately for working CRLF and repository Git blob bytes.
