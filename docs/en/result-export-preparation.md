# Asynchronous result export preparation separation (MOD1)

[日本語](../result-export-preparation.md)

`src/result-export-preparation.js` extracts visual export preparation and renderer handoff from `main.js`. It handles stale/cancelled result inspection, detached view snapshots including thermal physical time, pre-render identity checks and discarded late completions after cancellation/disposal. Rendering, artifact bytes/hashes, job retention and public APIs remain with the existing job service and renderer. Saved formats and visible presentation are unchanged.

The adapter borrows `result-selection-state.capture`. It does not add a selection generation counter or saved identity. Returning from A to B to the identical A still invalidates old work. The captured guard and result reference remain bound through the handoff, which also checks expectedResultRevision. Returned view/setup objects are detached.

Cancellation discards pending preparation and links job/adapter cancellation to the renderer's own signal. Ownership remains until an abort-ignoring renderer settles; another prepare/render is refused during that interval. Finally releases only the owned operation. Permanent disposal does not dispose the borrowed selection owner.

Main actually passes this adapter to the job service. Clearing results, cancelling analysis and export cancelAll cancel preparation. Page departure cancels when retained in bfcache and permanently disposes otherwise, preserving existing selection invalidation.

Synthetic fixtures verify former inline snapshot/artifact/status equivalence, A/B/A staleness, preparation cancellation, unsettled render exclusion, disposal, error cleanup and integration with the real job service. Physical solver acceptance, browser measurements and publication are outside this extraction.
