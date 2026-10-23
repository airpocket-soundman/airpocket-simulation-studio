# Independent crosscheck of disconnect probe 194b

[日本語](../orbit194b-independent-review-2026-10-24.md)

At fixed base `a4e1430`, runtime `c26010082fa5d23ab3b910116ac0e60227041748`, an independent script checked lengths/SHA-256 for 32 captured files, the driver SHA, five unchanged physical-state snapshots, session transition, release and cleanup records. It ran zero additional exports, codecs or solvers.

Formal MCP recorded running progress 13.773% / executionSettled:false and the foreground GUI had an enabled disconnect control and recording locks. The click request followed receipt of the marker by 615ms. However, focus emulation timed out: neither a successful click response nor a disconnect effect before completion was established. The job subsequently completed and settled; a fresh session read one artifact byte. The reported 354459-byte size and SHA are metadata, not a full-media byte/hash/decode verification.

Both 194a and 194b remain partial. Cancellation, cancelled-artifact refusal and restoration after cancellation remain unproven. The older 194a refusalBasis text describes an intended criterion, not an observed cancellation refusal; 194b correctly separates actual refusalBasis:null from plannedRefusalBasis.

Later ordinary disconnect evidence establishes old-session refusal, empty sessions, Unknown after job release, restored GUI controls, owned-child graceful exit, absent PID and removed private token. executionSettled itself describes Promise-chain completion and queue-exclusion release; it does not guarantee OS/codec/GPU resource teardown. Only Japanese foreground IAB was exercised; English, hidden and other-engine conditions remain open. The 171/37 statuses and progress data are unchanged.

Replay: `node docs/evidence/verify-orbit194b-independent.mjs`. Original captures and inventory remain unchanged. See the [independent JSON](../evidence/2026-10-24-orbit194b-independent.json) and [original 194b record](../evidence/2026-10-24-orbit-disconnect-synchronized-partial/README.md).
