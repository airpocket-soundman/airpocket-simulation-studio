# Node-side performance measurement harness (PERF1 / P2 first slice)

Japanese: [../performance-measurement.md](../performance-measurement.md)

`scripts/perf-measure.mjs` analyses representative in-repo models in a Node Worker (WASM, CPU) and records timings, mesh size and peak memory as JSON. **The numbers are measurements, not support limits or performance guarantees.** PERF1 (browser memory, runtime and cancellation latency, with displayed limits) and the P2 performance measurement remain incomplete; this harness alone does not complete them.

## What is measured

- Cases: a 10x10x40 mm box (same shape as the worker pipeline tests) solved as structural (several mesh sizes), steady thermal and harmonic acoustic. `--list` prints them.
- Node and element counts per case.
- Times (ms): total, Worker start to mesh start, meshing, boundary transfer, solve phase, solver kernel (solver-reported `solveMs`), and post-processing (solve phase minus solver kernel; includes result assembly and message cloning). Phase boundaries are approximations derived from host-side event arrival times.
- Cold vs warm: each case runs in a dedicated child process; its first run is cold and the following `--repeats` runs (default 3) are warm, with median, min and max recorded. Warm runs still spawn a fresh Worker each time.
- Peak RSS: the child process `process.resourceUsage().maxRSS` (whole-process peak including Node, the Worker and WASM memory).
- Environment: Node and v8 versions, OS and architecture, CPU model and logical CPU count, total memory, git revision, branch and dirty flag.

## What is NOT measured

- Browser (Chrome etc.) memory, runtime or cancellation latency; that is the core of PERF1 and needs separate measurement.
- WebGPU / GPU.
- Network, transfer size, artifact size or connection conditions.
- Browser cache cold/warm (here "cold" only means right after process start; disk and HTTP caches are not controlled).
- Memory ceilings, out-of-memory behaviour, and analysis cancellation latency.
- Coverage of multiple machines; one run on one machine is not representative.

## How to run

```
node scripts/perf-measure.mjs                      # all cases, writes .qa/perf-report.json
node scripts/perf-measure.mjs --out <file> --repeats 1 --cases structural-tiny,thermal-steady
node scripts/perf-measure.mjs --list
```

`.qa/` is git-ignored. The report carries `schemaVersion: 1` and `scope: "node-worker-wasm-cpu; not browser, not GPU, not network"`. A failed case records `status: "failed"` and `error`, and the exit code is 1. `tests/perf-measure.test.mjs` runs the smallest case and validates only the schema and required fields; it has no timing thresholds.

## Interpretation

Report values are results for that environment and build at that time. Do not treat them as supported size limits, performance targets or guarantees; deciding supported sizes needs follow-up work that includes browser measurement. Do not write these numbers into documentation or the UI as guarantees.
