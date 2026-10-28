# Isolated WASM diagnosis for PR187

[日本語](../pr187-runtime-diagnostic.md)

CI run39966324760 reported file-level failure after the first two advanced-structural-source tests, at 18.547 seconds. Its spec log preserves no signal or exit reason and contains no known V8 fatal signature. OOM, signal, V8 failure and assertion failure remain unresolved. The elapsed time is below the 120-second analysis timeout but does not establish a cause.

The existing `WASM runtime diagnostic comparison` workflow now accepts `target=advanced-structural-source` with `mode=single`. Single runs exactly once regardless of the iterations input, directly invoking reproduce without GC or concurrency overrides. Existing two-mode comparison remains available. Normal npm test, Node, solver and physical thresholds are unchanged.

Diagnostic children explicitly use TAP, preserving stdout/stderr, exit code, signal and timeout in JSON. Linux cgroup v2 memory.events/current/peak/max are sampled before and after each run. Missing values have available=false; counters remain exact strings and max represents an unlimited limit. Counters describe the runner's shared cgroup: an oom_kill increment alone does not identify the failed child. Windows records not-linux. Output bounds, exclusive evidence creation and stopping on failure are retained.

[Raw Windows TAP](../evidence/2026-10-23-pr187-structural-windows.tap) and [execution metadata](../evidence/2026-10-23-pr187-structural-windows.json) come from the previously authorized single execution before diagnostic changes. Target source SHA256 `2a19c5aabaca822171e1bbf29dde7e292f15f644d754a4c8142df51993a2830c` matches base bb6f24c. All three passed on Node v24.11.1 in 7733 ms, exit0, no signal, empty stderr. This neither fixes the CI failure nor establishes flakiness. Linux workflow execution is pending root dispatch.

## 2026-10-23 follow-up: isolated Linux diagnosis and independent audit

The pending Linux statement above is historical. [Focused run39968250962](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39968250962) used clean head `f2db420e49af992f1bbaa87204082856aaf6643b`, Linux Node24.21.0/V8 13.6.233.17-node.53 and one default-GC execution. There was no concurrency override or NODE_OPTIONS. Explicit TAP records3/3 passing,0 failures/skips,4782ms,exit0,signal null,no timeout and empty stderr. This is an **isolated non-reproduction**, not a root cause, fix or proof of flakiness for the original full-suite failure39966324760.

The previously downloaded [raw JSON](../evidence/pr187-linux-focused-20261023/wasm-single.json) is41893bytes,SHA256 `babb7a0ea7b55ac53977128900dcd132e9b85f3dd2f0d1e496aefad85f411c47`. Its copy was checked byte-for-byte and protected with `* -text`. [TAP](../evidence/pr187-linux-focused-20261023/wasm-single.tap) was extracted from its stdout without another execution. [The audit record](../evidence/2026-10-23-pr187-linux-focused-audit.json) fixes head,arguments,hashes and before/after cgroup values.

The Linux target-source SHA256 matches git blob LF bytes: `d44a59cce4d7c2369bb968bc9eb3c986526e896d39b873b715cf823fe59fc1e2`. The historical Windows value `2a19c5aabaca822171e1bbf29dde7e292f15f644d754a4c8142df51993a2830c` matches a CRLF conversion of that same blob. Target blobs at bb6f24c and f2db420 are identical. This is a line-ending byte difference, not different test logic. Original Windows evidence is unchanged.

Runner cgroup oom/oom_kill remained0→0. memory.peak changed3146035200→3357949952bytes; memory.current2857308160→2858680320bytes; memory.max was max. These are shared cgroup cumulative/lifetime values, not this child's peak RAM,RSS or OOM attribution, and they do not rule out OOM in the old failed execution.

Read-only independent review of e836b4e's seven changed files confirmed TAP/signal preservation, missing cgroup values and exact strings,single default-GC execution once,and unchanged ordinary pages workflow/npm test/solver thresholds. Related15 tests passed with0 failures/skips; no solver was rerun and no actionable new defect was found. Ordinary CI39968241372 was reported in progress at handoff and remains unconfirmed in this record.
