# Independent retained opening-surface provider audit

[日本語](../opening-provider-independent-2026-10-26.md)

Owner `8a515074780c55a29b31644090d2ed4bac05af79` admitted five replacements while five fake SHA operations remained unresolved. A per-input cap did not bound total retained snapshots. Owner fix `9e81c33f43a0d177c7c8d3544c719c2ff2f1fc69` reserves at most two pending slots before snapshotting and refuses overflow with `OPENING_SURFACE_PENDING_LIMIT`. Every admitted exit releases its slot in finally; clear/dispose do not falsely reset unresolved accounting.

Two independent regressions verify that malformed input cannot steal a pending generation; overflow performs no caller inspection; hash failure frees capacity; late old completion cannot overwrite a newer lease; and disposal prevents resurrection. Together with eight owner regressions, ten passed with zero failures or skips. Source hashes and scope are in the [evidence JSON](../evidence/2026-10-26-opening-provider-independent.json). Both reciprocal documentation checks also passed.

This handles private snapshots and instance-local leases for explicit indexed surfaces only. CAD conversion, persistence, GUI and solver integration remain unimplemented; forced hash termination is not guaranteed. Additional solver/GUI/codec runs and progress changes: zero.

Replay: `node --test tests/retained-opening-surface-independent.test.mjs tests/retained-opening-surface.test.mjs`.
