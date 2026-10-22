# Two Chrome mesh sizes and probe correction

[Japanese](../perf-scale-2026-10-22.md)

Actual Chrome155 on localhost used fixed source `1ae8dcf8f58177b65e91900f00b79aa453c4307d`, formal inspect/analyze MCP and a synthetic10×10×40mm bar: E1e9Pa, nu0, z0 fixed, +Z100N at z40. Each size had one cold/warm solve, two cancellations and recovery.

| mesh size | nodes / Tet4 elements | cold ms | warm ms | sampled JS heap maximum bytes |
|---|---:|---:|---:|---:|
| 8mm | 60 /121 | 1809.459 | 1624.154 | 33,255,669 |
| 3mm | 335 /1006 | 1543.110 | 1686.913 | 32,461,135 |

Counts come from actual jobStatus results, not requested size. Compact summaries identify job/input but expose no mesh-content hash; meshRevision stays null. Equal counts do not establish equal meshes.

The first attempt reproduced a slow UASM request suppressing synchronous heap ticks. The correction samples heap every tick and serializes only UASM. Separate records retain independent times/values;57 samples were captured. Tiny-window UASM remains unavailable. Medium-window sampled UASM maximum was53,933,349bytes from one complete interval. Do not sum series or call sampled maxima true peak/RSS/GPU usage. Heap samples at least3000ms after cancellation/settlement are retained.

[Evidence](../evidence/2026-10-22-perf-scale.json) retains [raw data, first attempt and exact replay helpers](../evidence/perf-scale-20261022). This single-repeat comparison proves no support limit or scaling law. Other browsers, public HTTPS and real-Chrome verification of the new comparison timing manifest remain untested.

For replay, pin a dedicated worktree to the source above; copy the four replay files and input.json to `.qa/perf-scale-v2/`. Run Vite on127.0.0.1:18444 and `node .qa/perf-scale-v2/driver.mjs`. Open the owned Chrome page `/.qa/perf-scale-v2/perf.html?lang=en`, load the synthetic input, start the probe and explicitly grant only inspect/analyze in the connection UI. Delete the temporary pairing handoff file after entry; never put its code in URLs, evidence or commits. Retain samples at least3000ms after settlement, stop and retrieve probe JSON, then merge using current mergeMemory. Stop the owned probe/tab/MCP/Vite; all were confirmed closed in this run.

