# Isolated WASM diagnosis for PR187

[日本語](../pr187-runtime-diagnostic.md)

CI run39966324760 reported file-level failure after the first two advanced-structural-source tests, at 18.547 seconds. Its spec log preserves no signal or exit reason and contains no known V8 fatal signature. OOM, signal, V8 failure and assertion failure remain unresolved. The elapsed time is below the 120-second analysis timeout but does not establish a cause.

The existing `WASM runtime diagnostic comparison` workflow now accepts `target=advanced-structural-source` with `mode=single`. Single runs exactly once regardless of the iterations input, directly invoking reproduce without GC or concurrency overrides. Existing two-mode comparison remains available. Normal npm test, Node, solver and physical thresholds are unchanged.

Diagnostic children explicitly use TAP, preserving stdout/stderr, exit code, signal and timeout in JSON. Linux cgroup v2 memory.events/current/peak/max are sampled before and after each run. Missing values have available=false; counters remain exact strings and max represents an unlimited limit. Counters describe the runner's shared cgroup: an oom_kill increment alone does not identify the failed child. Windows records not-linux. Output bounds, exclusive evidence creation and stopping on failure are retained.

[Raw Windows TAP](../evidence/2026-10-23-pr187-structural-windows.tap) and [execution metadata](../evidence/2026-10-23-pr187-structural-windows.json) come from the previously authorized single execution before diagnostic changes. Target source SHA256 `2a19c5aabaca822171e1bbf29dde7e292f15f644d754a4c8142df51993a2830c` matches base bb6f24c. All three passed on Node v24.11.1 in 7733 ms, exit0, no signal, empty stderr. This neither fixes the CI failure nor establishes flakiness. Linux workflow execution is pending root dispatch.
