# Node-side performance measurement harness (PERF1 / P2 first slice)

Japanese: [../performance-measurement.md](../performance-measurement.md)

`scripts/perf-measure.mjs` analyses representative in-repo models in a Node Worker (WASM, CPU) and records timings, mesh size and peak memory as JSON. **The numbers are measurements, not support limits or performance guarantees.** PERF1 (browser memory, runtime and cancellation latency, with displayed limits) and the P2 performance measurement remain incomplete; this harness alone does not complete them.

## What is measured

- Cases: a 10x10x40 mm box (same shape as the worker pipeline tests) solved as structural (several mesh sizes), steady thermal and harmonic acoustic. `--list` prints them.
- Node and element counts per case.
- Times (ms): total, Worker start to mesh start, meshing, boundary transfer, solve phase, solver kernel (solver-reported `solveMs`), and post-processing (solve phase minus solver kernel; includes result assembly and message cloning). Phase boundaries are approximations derived from host-side event arrival times.
- Cold vs warm: each case runs in a dedicated child process; its first run is cold and the following `--repeats` runs (default 3) are warm, with median, min and max recorded. Warm runs still spawn a fresh Worker each time.
- Peak RSS: the child process `process.resourceUsage().maxRSS` (whole-process peak including Node, the Worker and WASM memory).
- Cancel response (`cancel` block, additive): by default for `structural-medium` and `thermal-steady`, and for every selected case with `--cancel` (`--no-cancel` disables it). In a dedicated child process, after a warm-up, an uncancelled warm run sets the baseline time; then cancellation is requested through the `AbortSignal` of `analyzeProject` at two points: (1) right after the first progress/observation event, and (2) at 50% of the median warm total time of that baseline. Each point is repeated `--repeats` times, and the latency from the cancel request to the settlement of the `analyzeProject` promise (which settles only after the Worker terminated) is recorded as median, min and max. The final state is one of `cancelled`, `completed-before-cancel` (lost the race) or `error`. `processReleased` records whether the child exits naturally (exit code 0, within the timeout); leftover handles would keep it alive and fail on timeout. The child's peak RSS is recorded too. The report stays schema version 1; only a `cancel` block is added per case.
- Environment: Node and v8 versions, OS and architecture, CPU model and logical CPU count, total memory, git revision, branch and dirty flag.

## What is NOT measured

- Browser (Chrome etc.) memory, runtime or cancellation latency; that is the core of PERF1 and needs separate measurement (plan: [perf-browser-plan.md](perf-browser-plan.md)). The `cancel` block covers Node Worker + AbortSignal only; browser cancel response is NOT measured.
- WebGPU / GPU.
- Network, transfer size, artifact size or connection conditions.
- Browser cache cold/warm (here "cold" only means right after process start; disk and HTTP caches are not controlled).
- Memory ceilings and out-of-memory behaviour. Cancellation latency is measured on the Node side only, not in the browser.
- Coverage of multiple machines; one run on one machine is not representative.

## How to run

```
node scripts/perf-measure.mjs                      # all cases, writes .qa/perf-report.json
node scripts/perf-measure.mjs --out <file> --repeats 1 --cases structural-tiny,thermal-steady
node scripts/perf-measure.mjs --cases structural-medium --cancel --repeats 5   # include cancel response
node scripts/perf-measure.mjs --list
```

`.qa/` is git-ignored. The report carries `schemaVersion: 1` and `scope: "node-worker-wasm-cpu; not browser, not GPU, not network"`. A failed case records `status: "failed"` and `error`, and the exit code is 1. `tests/perf-measure.test.mjs` runs the smallest case and validates only the schema and required fields; it has no timing thresholds.

## Browser-side measurement (`scripts/perf-browser.mjs`; implemented, real-browser run pending)

Drives the real page on localhost through the stdio connector (`node scripts/studio-mcp.mjs --browser-origin=<origin>`). **Any origin other than localhost, 127.0.0.1 or [::1] is refused.** Results are measurements, not limits or guarantees. No real-browser values exist yet and PERF1 stays open.

```
node scripts/perf-browser.mjs [--origin http://127.0.0.1:5174] [--out .qa/perf-browser-report.json] [--repeats 3] [--cases structural-tiny,structural-medium,structural-fine] [--timeout-ms 300000] [--pair-timeout-ms 600000]
node scripts/perf-browser.mjs --print-probe        # print the memory probe snippet
node scripts/perf-browser.mjs --merge-memory <probe.json> --out .qa/perf-browser-report.json
```

Operator procedure: (1) Start the dev server, open `<origin>/?lang=en` in a dedicated profile and tab, and load the 10x10x40 mm block with the study for the physics being measured. (2) Optional memory: paste the `--print-probe` snippet into DevTools (`window.__perfProbe` records `measureUserAgentSpecificMemory` (cross-origin isolated only) or `performance.memory` every second). (3) Run the command in an interactive terminal. Enter the endpoint and pairing code shown there into the app connection UI and grant **only the inspect and analyze scopes**. The code is shown on the terminal only and is never written to a file, the report or a log (it is withheld when stdout is not a terminal). (4) Measurement starts automatically once a session appears; do not touch the page until it finishes. (5) Memory: afterwards save the output of `copy(__perfProbe.report())` to `.qa/probe.json` and merge it with `--merge-memory`. Without a probe the report's `memory` is `null` with `memoryReason` `probe-absent...` (explicitly not measured).

Per case the script freezes the input revision and runs `startJob` (options.size = the case mesh size) once cold and `--repeats` times warm, waiting for `jobStatus` (`executionSettled`) to settle within the timeout. Phase times come from `jobEvents` receive times. Cancel requests `cancelJob` (a) after the first event and (b) at 50% of the median warm total, `--repeats` times each, and records the latency from the request to the observed settled state (terminal and `executionSettled`), including the polling granularity (`--poll-ms`, default 50 ms). It also records whether a re-run succeeds afterwards (`recoveredAfterCancel`). A job that never settles marks the case `failed` (`timedOut`) and the exit code is 1. Thermal and acoustic physics depend on the input loaded in the page and are not verified by the script: load the thermal setup before running `--cases thermal-steady`.

The report has `schemaVersion: 1`, `scope: "browser via connector; localhost; real browser"`, the revision, the browser user agent (from the probe when inspect does not return it, otherwise `null`) and per-case `cold`/`warm`/`cancel`/`memory`. Times are host-observed through the connector, not in-page `performance.now()`. GPU, network, other browsers and memory limits are not measured. `tests/perf-browser.test.mjs` checks the schema, refusal, timeout handling and token non-leakage with a fake connector.

## Interpretation

Report values are results for that environment and build at that time. Do not treat them as supported size limits, performance targets or guarantees; deciding supported sizes needs follow-up work that includes browser measurement. Do not write these numbers into documentation or the UI as guarantees.

## Partial real-Chrome measurements,2026-10-18

[Evidence](../evidence/2026-10-18-browser-performance-real-chrome.json). Existing10x10x40mm structural input,mesh sizes8/3/2mm: cold905.563/885.355/1182.657ms; one warm run775.220/775.162/1080.749ms. Cold means first case run in the same page/existing runtime, with browser/HTTP caches uncontrolled. All six first-event/half-warm cancellations ended cancelled; host request-to-terminal-and-executionSettled observation149.076–172.910ms, and recovery solves succeeded. Times include connector round trips/100ms polling and are observations,not support limits or guarantees.

Thermal size3mm was interrupted by command timeout. Follow-up read-only inspect/listJobs timed out too(listJobs delivered:false); an independent observer saw the same tab reset to initial input with its connection closed. Cause remains unknown; no retry was made. Memory is not exposed by supported semantic diagnostics and was not observed. PeakRAM/support limit/other browsers/thermal time and cancel measurements remain unavailable; PERF1 stays building.
