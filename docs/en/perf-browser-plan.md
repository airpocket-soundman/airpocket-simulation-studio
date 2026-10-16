# Browser performance measurement plan (PERF1 / P2 remainder)

Japanese: [../perf-browser-plan.md](../perf-browser-plan.md)

**Status: script implemented, real-browser run pending.** `scripts/perf-browser.mjs` (driven through the stdio connector; unit-tested with a fake connector) exists, but no real-browser values have been measured. The "Approach" below is the original CDP/tab-API design; the implementation instead uses the stdio connector (`jobStatus`/`jobEvents`/`cancelJob`), so times are host-observed rather than in-page `performance.now()`, and memory is optional via an operator-pasted `window.__perfProbe`. See [performance-measurement.md](performance-measurement.md) for usage. Original text: Node-side measurement is in [performance-measurement.md](performance-measurement.md) (`scripts/perf-measure.mjs`). This document designs `scripts/perf-browser.mjs`, which will measure what PERF1 asks for: browser memory, time and cancel response. Until it exists, nothing is claimed about browser values. Results will be measurements, not support limits or guarantees.

## Goal and scope

- Measure: in real Chrome against a locally served app, per-case cold and warm duration, page memory, cancel response, and memory release after cancel.
- Not measured (stated explicitly): GPU/WebGPU rendering, network, transfer size and connection conditions, browsers other than Chrome, multiple machines, memory ceilings and out-of-memory behaviour (separate work). The published HTTPS site is out of scope (PUBLICHTTPS1 is unverified).

## Method

Reuse the existing real-Chrome driver pattern: browser actions go through the connector (`scripts/studio-browser-mcp.mjs` / `scripts/browser-bridge.mjs`) or the tab API used by `scripts/qa-browser.cua.js` (`tab.goto`, `tab.playwright.locator(...)`, `evaluate`). `scripts/perf-browser.mjs` is an orchestrator on top of it. It reuses `CASES` from `scripts/perf-measure.mjs`, analysing the same 10x10x40 mm box at the same mesh sizes so values can be compared with the Node numbers.

### Page prerequisites

- The page must be `crossOriginIsolated === true`; `performance.measureUserAgentSpecificMemory()` works only under cross-origin isolation. The app gets isolation from `public/coi-serviceworker.js` and the headers in `vite.config.js`. If not isolated, the memory block records `null` with reason `not-cross-origin-isolated` and only time and cancel are measured (never silently reported as success).
- Reads happen through in-page `evaluate`; app source is not modified.

### Operations called

1. `tab.goto(http://localhost:<port>/?lang=en)` for a fresh load (cold = the first analysis in that tab). Warm = re-running in the same page without reload.
2. Load the case: the existing demo buttons, or project JSON load (exported from the `perf-measure.mjs` cases); set the mesh size in the settings field.
3. Solve: click `#solve-run` and wait until `#status` shows completion. Time is taken in-page with `performance.now()` (a start mark set by `evaluate` just before the click, and a `MutationObserver` on `#status`); host RPC round trips are excluded.
4. Cancel: click the page's cancel control while the solve runs (the same path a user takes, not a connector-side `cancel`), and measure in-page the time until `#status` shows cancelled and execution stops. Cancel points match the Node harness: (a) after the first progress display, (b) at 50% of that case's median warm total.
5. Memory: call `await performance.measureUserAgentSpecificMemory()` at (i) just after load (baseline), (ii) just after solve, (iii) just after cancel, (iv) a few seconds later, after requesting GC only where available. Record `bytes` and the Worker-attributed part of `breakdown` separately. `performance.memory.usedJSHeapSize` (non-standard, coarse) goes in a separate reference field. Peak is approximated by the maximum of sampling at a fixed interval (e.g. 200 ms); record the interval and sample count, and note that sampling itself uses memory.

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
    memory: {available, reason?, baselineBytes, afterSolveBytes, afterCancelBytes, afterSettleBytes, peakBytesSampled, samples: {intervalMs, count}},
    cancel: {points: {"first-progress": {latencyMs: {median,min,max,n}, states: {...}}, "half-warm-total": {...}},
             recoveredAfterCancel: boolean},
    notes: [...]
  }],
  notes: ["measurements, not limits or guarantees", "GPU, network, other browsers not measured"]
}
```

Final states are `cancelled` / `completed-before-cancel` / `error`, the same vocabulary as the Node harness. All values are measurements.

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
