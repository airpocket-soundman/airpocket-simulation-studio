# Browser performance measurement plan (PERF1 / P2 remainder)

Japanese: [../perf-browser-plan.md](../perf-browser-plan.md)

2026-10-22 probe correction: the new snippet permits only one outstanding UASM request and records `tRequested` and `tResolved`. Samples resolving after `stop()` are discarded; reinstalling stops the previous probe. JS heap is synchronous at request time; UASM spans an asynchronous interval. Baseline and in-window peak accept a UASM interval only when it fits wholly within that phase. Legacy `t`-only samples retain their historical interpretation with completion explicitly unknown. This change does not rerun earlier measurements.

**Current: real-Chrome timing/cancellation measured for three structural sizes; thermal interrupted by reset/timeout. PR174 records separate UASM/JS heap series for one small structural case on 2026-10-22. New-probe replay, other browsers and support limits remain unverified.** See the2026-10-18 evidence below. The following is historical design; actual scripts/perf-browser.mjs uses host-observed connector timing. It does not mean CDP/hidden-global memory measurements were performed.

## Goal and scope

- Measure: in real Chrome against a locally served app, per-case cold and warm duration, page memory, cancel response, and memory release after cancel.
- Not measured (stated explicitly): GPU/WebGPU rendering, network, transfer size and connection conditions, browsers other than Chrome, multiple machines, memory ceilings and out-of-memory behaviour (separate work). The published HTTPS site is out of scope (PUBLICHTTPS1 is unverified).

## Method

Reuse the existing real-Chrome driver pattern: browser actions go through the connector (`scripts/studio-browser-mcp.mjs` / `scripts/browser-bridge.mjs`) or the tab API used by `scripts/qa-browser.cua.js` (`tab.goto`, `tab.playwright.locator(...)`, `evaluate`). `scripts/perf-browser.mjs` is an orchestrator on top of it. It reuses `CASES` from `scripts/perf-measure.mjs`, analysing the same 10x10x40 mm box at the same mesh sizes so values can be compared with the Node numbers.

### Page prerequisites

- The page must be `crossOriginIsolated === true`; `performance.measureUserAgentSpecificMemory()` (the `uasm` series, semantic whole-agent bytes) works only under cross-origin isolation. The app gets isolation from `public/coi-serviceworker.js` and the headers in `vite.config.js`. If not isolated, the `uasm` series is unavailable and only the coarse `performance.memory.usedJSHeapSize` (`jsHeap` series, JS heap only) is recorded as its own series (never silently reported as success, never substituted for the other series).
- Reads happen through in-page `evaluate`; app source is not modified.

### Operations called

1. `tab.goto(http://localhost:<port>/?lang=en)` for a fresh load (cold = the first analysis in that tab). Warm = re-running in the same page without reload.
2. Load the case: the existing demo buttons, or project JSON load (exported from the `perf-measure.mjs` cases); set the mesh size in the settings field.
3. Solve: click `#solve-run` and wait until `#status` shows completion. Time is taken in-page with `performance.now()` (a start mark set by `evaluate` just before the click, and a `MutationObserver` on `#status`); host RPC round trips are excluded.
4. Cancel: click the page's cancel control while the solve runs (the same path a user takes, not a connector-side `cancel`), and measure in-page the time until `#status` shows cancelled and execution stops. Cancel points match the Node harness: (a) after the first progress display, (b) at 50% of that case's median warm total.
5. Memory: call `await performance.measureUserAgentSpecificMemory()` at (i) just after load (baseline), (ii) just after solve, (iii) just after cancel, (iv) a few seconds later, after requesting GC only where available. Record `bytes` and the Worker-attributed part of `breakdown` separately. `performance.memory.usedJSHeapSize` (non-standard, coarse) goes in a separate `jsHeap` series. **The `uasm` series (semantic whole-agent) and the `jsHeap` series (JS heap only) cover different scopes: never mix them with a per-sample fallback, never substitute one when the other is missing, and never sum them.** Peak is approximated by the maximum of sampling at a fixed interval (e.g. 200 ms/1000 ms); record the interval and sample count, and note that sampling itself uses memory.

### Cases and repeats

- Cases: `structural-tiny`, `structural-medium`, `structural-fine`, `thermal-steady` (optionally `acoustic-harmonic`). Limit search is separate work.
- Per case: 1 cold run, N warm runs (default 3), N cancels at (a), N cancels at (b). After each cancel, record whether a following solve in the same page succeeds.
- Reload the tab only before the cold run.

## Report schema (`schemaVersion: 1`, separate file from the Node report)

```
{
  schemaVersion: 1,
  scope: "chrome-localhost-wasm-cpu; not gpu, not network, not public site",
  generatedAt, git: {revision, branch, dirty},
  environment: {chromeVersion, userAgent, platform, cpuCount, deviceMemoryGiB, crossOriginIsolated, appVersion},
  repeats,
  cases: [{
    id, physics, meshSize, status: "ok"|"failed", error?,
    cold: {totalMs, solveMs, ...}, warm: {runs: [...], summary: {totalMs: {median,min,max,n}}},
    memory: {available, primarySeries, intervalMs, sampleCount,
             series: {uasm:  {available, source, baselineBytes, peakBytesSampled, afterCancelBytes, afterSettleBytes, sampleCount, unavailable},
                      jsHeap: {available, source, baselineBytes, peakBytesSampled, afterCancelBytes, afterSettleBytes, sampleCount, unavailable}},
             note},
    cancel: {points: {"first-progress": {latencyMs: {median,min,max,n}, states: {...}}, "half-warm-total": {...}},
             recoveredAfterCancel: boolean},
    notes: [...]
  }],
  notes: ["measurements, not limits or guarantees", "GPU, network, other browsers not measured"]
}
```

Final states are `cancelled` / `completed-before-cancel` / `error`, the same vocabulary as the Node harness. All values are measurements.

### Memory series handling (implementation: `mergeMemory`)

`memory.series` keeps series of different scope separate. `uasm` = `performance.measureUserAgentSpecificMemory().bytes` (cross-origin isolated only, semantic whole-agent), `jsHeap` = `performance.memory.usedJSHeapSize` (non-standard, coarse, JS heap only). Per series, `peakBytesSampled` (an approximation from the maximum of periodic samples), the baseline (the last sample before the case window) and `afterCancelBytes`/`afterSettleBytes` (the first sample at `cancelSettledEpochMs`/`endEpochMs` + 3000 ms) are taken from that series' own samples only. **Series are never summed, a mixed maximum is never called total RAM, and a missing series is never substituted by the other.** `NaN`/`Infinity`/negative/`null` values are not adopted as measurements. Even when only one series has values, `series` keeps both; the empty one has `available:false` and an `unavailable` reason. If no sample is usable inside the window, `memory` is `null` with a `memoryReason`. Flat compatibility fields (only the single series named by `primarySeries`) coexist with `series` and never combine series. `mergeMemory` mutates `report` in place and returns it (the existing contract); `probe` is read-only. `schemaVersion` stays 1 (series separation is additive).

## Safety rules

- **localhost only**: never navigate to anything other than `localhost`, `127.0.0.1` or `[::1]`; no argument accepts a public or external URL.
- **No tokens or secrets in files**: connector tokens and URL credentials are never written to reports, logs or committed files. Reports keep only the URL origin, without tokens.
- **One Chrome session at a time**: no concurrent tabs or browsers during measurement (avoids interference and resource contention). Measurement is serial, in one dedicated work tab, closed at the end.
- Read, analyse and cancel only; never modify or delete user data (case lists, saved projects). Because a page reload can replace the case list, run only in a dedicated profile and tab.
- Output goes to `.qa/` (git-ignored).
- Start the dev server via `preview_start` or equivalent, stop it after measurement, and send nothing externally.

## Implementation steps (future)

1. Skeleton of `scripts/perf-browser.mjs` (arguments, localhost validation, `CASES` reuse, report writing) with browserless tests for schema and argument validation.
2. Keep the in-page snippets (start mark, `MutationObserver`, memory sampler) as separable strings and unit-test the pure parts in Node.
3. Measure one real case through the connector to confirm `crossOriginIsolated` and memory API availability.
4. Measure all cases, produce a comparison table against Node (including cancel), update docs. Updating the PERF1 backlog entry happens separately, once values exist.

## Done criteria (for PERF1)

Browser memory, time and cancel response are measured for the cases above and recorded with their environment. Deciding memory ceilings and supported sizes is further, separate work.

## Partial real-Chrome measurements,2026-10-18

[Evidence](../evidence/2026-10-18-browser-performance-real-chrome.json). Existing10x10x40mm structural input,mesh sizes8/3/2mm: cold905.563/885.355/1182.657ms; one warm run775.220/775.162/1080.749ms. Cold means first case run in the same page/existing runtime, with browser/HTTP caches uncontrolled. All six first-event/half-warm cancellations ended cancelled; host request-to-terminal-and-executionSettled observation149.076–172.910ms, and recovery solves succeeded. Times include connector round trips/100ms polling and are observations,not support limits or guarantees.

Thermal size3mm was interrupted by command timeout. Follow-up read-only inspect/listJobs timed out too(listJobs delivered:false); an independent observer saw the same tab reset to initial input with its connection closed. Cause remains unknown; no retry was made. Memory is not exposed by supported semantic diagnostics and was not observed. PeakRAM/support limit/other browsers/thermal time and cancel measurements remain unavailable; PERF1 stays building.

2026-10-22 follow-up: schemaVersion=2 probes exclude missing, null, reversed, nonfinite or inconsistent request/resolution timestamps from all UASM phases. Legacy schema1 request-only records remain explicitly distinguishable; memoryProbeAudit reports rejected timing counts. Synchronous heap observations remain independent.

Successful cold/warm/recovered runs retain nodeCount/elementCount from the formal MCP jobStatus.result.mesh with jobId/inputRevision in meshObservation. Missing/invalid counts remain null with a reason; requested size is never used to infer counts. Compact summaries expose no mesh-content hash, so meshRevision remains null and equal counts do not establish identical meshes. QA_PERF_CASES=structural-tiny,structural-medium selects two bounded sizes in the existing 48 replay helper. Added tests verify mocked contracts, not a new Chrome measurement.
