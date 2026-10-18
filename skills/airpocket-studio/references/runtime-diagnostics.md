# Runtime Diagnostics

Repository-version reference. Discover actual connected tools before using names below; older registered servers may expose only a subset. Read only the sections needed for the task.

## Recover from runtime termination

A V8 `jit_page_->allocations_.erase(addr) == 1` fatal is an unresolved runtime failure; do not label it physical invalidity or solver nonconvergence. After an stdio process stops, its in-memory jobs/events and retained request-id idempotency are lost. Do not assume old job IDs can be recovered. Before retrying, reread original inputs, existing output paths and published artifacts to establish what completed; use a new outputPath/requestId for recomputation. Do not overwrite files or silently change solver/tolerances.

For investigation, scripts/reproduce-wasm-runtime.mjs can fix target/runtime/concurrency and save an exclusive report with parent/child runtime identities and source fingerprints; consult docs/wasm-runtime-investigation.md. Node24.19.0 retains the old wrapper code and is not a fixed control. Node26 source contains the correction/successor implementation, making it a comparison candidate, not proof that this application's root cause is resolved.

The separate `Check failed: jit_page.has_value()` signature is also a runtime fatal; do not assume it has the same cause as the allocation-erase failure. Use `scripts/compare-wasm-runtime.mjs` or the manual Linux diagnostic workflow for a bounded same-source comparison of default flags and explicit `--no-wasm-code-gc`. This does not change ordinary tests or production launch flags. The diagnostic children remove `NODE_OPTIONS`; separate spawned processes do not automatically receive the flag. Windows smoke success in both modes establishes runner execution only, not mitigation or a root fix. Reports distinguish failure, interruption and unconfirmed child cleanup; descendant-tree cleanup is not guaranteed.

Job cancellation/timeout can become terminal before execution exits. Check executionSettled/resourceState through existing status/list/events and wait for resource-state settlement before release or treating its slot as free; pending jobs keep requestId idempotency. Internal drain snapshots only currently pending executions; it is not a new MCP operation or V8 root-cause fix.

Use releaseAllowed:true as the release gate. resourceState:"settled" means the executor Promise settled after adapter cleanup, not confirmed OS-thread exit for void browser Worker.terminate(). A terminal-late rejection is executionError.code:"JOB_EXECUTION_REJECTED_AFTER_TERMINAL" while original cancel/timeout error remains; do not infer cleanup failure from this code alone. Service drain/closeAsync and normal EOF await cleanup; synchronous close remains compatible.

GUI run waits for terminal plus executionSettled, and history pruning requires releaseAllowed. Shared analysisApi.isBusy/drainJobs/closeJobsAsync expose host cleanup coordination; they add no wire methods. Connector mutations also check global busy state, so wait for settlement before retrying edits.

Cancellation can race completion: cancelled:false or terminal success does not mean the computation was cancelled. Inspect returned state and events before reporting cancellation.

## Optional isolated Node jobs

An operator may explicitly start studio-mcp with --analysis-isolation=process. It runs one same-executable Node child per saved-input job, with no retries, bounded stderr-tail/hash runtime-failure events and cleanup after process close. Default worker isolation and browser Workers remain unchanged. Do not pass arbitrary executable/shell options on the wire or claim a V8 root fix. Inspect published artifacts after a failed job before creating a new request/output.

Process-isolation failure events use code:ANALYSIS_PROCESS_EXIT. Controlled exit86 tests establish containment behavior, not reproduction/resolution of a V8 native fatal. Parent-disconnect cleanup is best effort; synchronous native work may delay child exit.

### Execution failure diagnostics

Read job.error.failure, late job.executionError.failure or direct MCP structuredContent.error.failure when present. The bounded schemaVersion:1 payload has code/stage/message/diagnostics; each diagnostic carries target, evidence, suggestions and requiresUserIntent alongside code/severity/stage/message. Legacy message/JOB_* codes remain. Invalid metadata is discarded; stacks/causes are excluded; payload size is at most 16,384 UTF-8 bytes.

Core-tagged constraint/boundary codes are more specific than generic stage fallbacks. A fallback identifies a phase, not a proven root cause. Treat suggestions as inspection guidance; do not invent material properties, supports or physical regions to make the solve pass. Caught Worker errors may emit a diagnostic event before terminal failure when observations are requested; delivery is not guaranteed. Inspect state/retained diagnostics after missing events. Failure blocks final JSON publication, while already-created mesh/intermediate artifacts can remain. Cleanup aggregates retain available primary diagnostics; cancellation ownership still lasts until execution settles. Diagnostic transport does not prove a root-cause fix, convergence or physical accuracy. Read `docs/automation.md` for the contract.

## Published-bundle verification isolation

The publication checker runs verified built analysis/CAD bundles and STEP fixture generation in separate same-executable Node child main processes. A result is provisional until child close succeeds; native fatal, signal, timeout, malformed IPC or nonzero exit fails the check. It does not retry or weaken numerical assertions. This changes publication QA, not default MCP or browser execution, and is not proof of a V8 root fix or actual browser stability. Check the report execution host and partial JSONL checkpoints before interpreting success.

The same V8 fatal signature was observed on Linux x64 Node24.21.0 in publication run38663202965. The full original V8 version was not retained. A matching runtime warning therefore uses Node version/platform/architecture only, reports recordedV8Version:null, and does not establish the exact engine build. Keep the failed evidence alongside subsequent successful runs.
