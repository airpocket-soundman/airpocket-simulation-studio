# Node 24 / WASM teardown crash investigation

[日本語](../wasm-runtime-investigation.md)

Checked: 2026-10-14. Status: unresolved.

The local full-suite log `.qa/print-api-full.log` shows the first two tests in `tests/analysis-job-service.test.mjs` passing before the fatal V8 CHECK `jit_page_->allocations_.erase(addr) == 1` terminated its test process. The stack includes `ThreadIsolation::UnregisterWasmAllocation`. The third test covers cancellation, timeout and artifact limits; the exact trigger is unknown. Other files ran concurrently.

On Windows x64, Node `v24.11.1`, V8 `13.6.233.10-node.28`, twelve sequential fresh child-process executions of only this file passed three tests each: 36 passes, exit code 0 throughout, empty stderr, 1612–1710 ms/process. This proves non-reproduction in isolation, not parallel safety or a fix.

Source baseline Git HEAD: `169404828cfc8eb36d382be600516c009a4549d6`. The table below identifies investigated source content.

Candidate: headless-analysis.mjs finish calls `worker.terminate()` without awaiting completion before settling its Promise, allowing a subsequent job to overlap isolate teardown. Cancellation/timeout in analysis-jobs.js reach the same path through AbortSignal. Whether overlap is necessary or awaiting teardown helps is untested.

Primary references checked 2026-10-14:

- [Node issue #66366](https://github.com/nodejs/node/issues/66366) reports the same CHECK on Node 24/V8 13.6 during worker teardown and WASM code GC. Its Linux environment differs from this Windows environment.
- [Official V8 fix 9b8ca54d5a](https://github.com/v8/v8/commit/9b8ca54d5a) fixes dying-wrapper reference updates racing another thread's code GC and potentially freeing the wrapper twice.

The CHECK, V8 family and teardown path fit a strong candidate; identity with this failure remains unproven. The other bundled runtime, Node `v24.19.0` / V8 `13.6.233.17-node.51`, was not used as a fixed-family control. This investigation changed no application behavior, solvers, tolerances or production launch flags.

Run the command below from the repository root with a new output name. The diagnostic allows 1–100 sequential fresh Node children running `node --test tests/analysis-job-service.test.mjs`, closed stdin, 30-second timeout, 1,000,000-byte limit per output stream, and stops on abnormal results. Runtime, Git HEAD, source hashes, exit code, signal and stderr go to exclusively created JSON. The original twelve runs sequentially executed the same target command.

One script-validation run passed three tests, exit code 0, no fatal. Concurrent work had changed src/analysis-jobs.js to SHA `ad3ca3718d9bcdc043e032bc112d25058b1663293c27745c9a041fc4200c1a02`; the other four hashes matched the table. Do not combine this additional run with the twelve as identical conditions.

Next compare a verified fixed runtime using identical source, hardware, target and iteration count. Record isolated and original full-suite parallel conditions separately; evaluate awaiting teardown independently. Treat `--no-wasm-code-gc` only as a diagnostic comparison until memory/performance costs and defect masking are assessed. Do not relax tolerances or exclude tests to declare success.

```powershell
node scripts/reproduce-wasm-runtime.mjs 12 .qa/wasm-runtime-new.json
```


| File | SHA-256 (12-process experiment) |
| --- | --- |
| `scripts/headless-analysis.mjs` | `fcba38379837fd6453337533fe5375bb67f38a456288ed6f8285fafc62686b27` |
| `scripts/headless-worker.mjs` | `93eedf9ea28b2173e6896bbf33d5a75940b8c412ee908bd86d18042984f7002c` |
| `scripts/analysis-job-service.mjs` | `31e13dda192136982e8f0970f7dc546dd0d8c9c6d944dbb3bbf90b329d8aff30` |
| `src/analysis-jobs.js` | `7ca4bc24d58005e7dc5d3c63b8b03e44965d2df36faffc18b9ca96e7f8b7f16e` |
| `tests/analysis-job-service.test.mjs` | `b6c778d514b3ec8d8abd0cea7143397f6197294dabf6c391cd789fac9c963b30` |

### 2026-10-14: recurring V8 stop during v2 bundle validation

The first full suite reported 518 tests: 514 passed, one failed and three skipped in 68.639 seconds. Node v24.11.1/V8 again stopped with the known fatal `jit_page_->allocations_.erase(addr) == 1`, failing the `tests/material-catalog.test.mjs` process. An isolated rerun of that file passed seven tests in 2.945 seconds. This does not establish root-cause resolution; RUNTIMEWASM1 remains unresolved.

The [machine-readable recurrence evidence](../evidence/2026-10-14-wasm-material-catalog-failure.json) preserves trace, Node/V8 environment, source hashes, initial results and the isolated retry. The saved full-suite retry passed 520 of 523 tests with three skips and zero failures in 68.229 seconds; all 26 distribution checks passed in 28.44 seconds. These are recorded alongside the original failure, not as proof of root-cause resolution.

## Diagnostic CLI and Worker ownership update

`node scripts/reproduce-wasm-runtime.mjs <1..100> <new-output.json> [--target=analysis-jobs|material-catalog|full] [--concurrency=1..4] [--runtime=<absolute Node executable>]` compares identical sources under selected runtimes. Defaults are analysis-jobs and the parent Node; omitted concurrency uses Node defaults. Full enumerates .test.mjs files directly under tests, with 180 seconds per run (30 for other targets) and a 1,000,000-byte limit per output stream. Failures stop subsequent iterations. Exclusive new output records synced checkpoints before/after each iteration, parent/child Node/V8, argv, Git dirty entries, test list, source/WASM hashes/fingerprint, stdout/stderr, exit code/signal and fatal detection. NODE_OPTIONS records presence/hash, not its value.

The headless completion Promise now waits for worker.terminate() before settling success/failure, including cancellation and timeout. This corrects resource ownership, not V8. Shared-job cancellation can become terminal earlier; all-terminal jobs do not guarantee all Workers have exited.

Official [v24.11.1](https://raw.githubusercontent.com/nodejs/node/v24.11.1/deps/v8/src/wasm/wasm-import-wrapper-cache.cc) and [v24.19.0](https://raw.githubusercontent.com/nodejs/node/v24.19.0/deps/v8/src/wasm/wasm-import-wrapper-cache.cc) retain old MaybeGet AddRef-before-is_dying ordering. Bundled v24.19.0 is not a fixed control. The official [v26.10.0 release](https://nodejs.org/en/blog/release/v26.10.0) tag contains [atomic V8 reference management](https://raw.githubusercontent.com/nodejs/node/v26.10.0/deps/v8/src/wasm/wasm-code-manager.h) and successor wrapper-cache code. Containing that correction does not prove this application's root cause is identical.

Official portable Node v26.10.0 / V8 14.6.202.34-node.34 was obtained only under .qa. node.exe SHA-256 `cea6ac365f9bb9586dafd2084d996e092e7d3e7d07ab52d1f76bf53d1fca9bc4` matched official SHASUMS. Global PATH and installed Node were unchanged. Frozen-source comparison results are recorded below. Non-reproduction alone cannot establish resolution.

## 2026-10-14: identical-source comparison after ownership repair

Source fingerprint: `f5baf41cf567a5adb08d84229b84a44f2c0018abb1dfff2aa88d6e863594b595`. The same 128 test files ran at concurrency four in two fresh processes per runtime. Node v24.11.1 passed 538 of 541 tests with three skips and zero failures in each run (wall68,083/69,192 ms; test67,986.382/69,098.2428 ms). Node v26.10.0 passed identical counts (wall163,283/161,887 ms; test161,603.2054/160,084.9643 ms). The known native fatal did not reproduce in any of four runs.

All comparisons used the ownership repair; there is no pre-change full-suite control under identical conditions. Node26 was slower in this observation, but cold start/security/cache were uncontrolled: this is not a product performance benchmark or causal proof that a particular V8/ownership correction resolved the stop. Default Node remains unchanged and RUNTIMEWASM1 remains unresolved.

Saved evidence includes the [comparison summary](../evidence/2026-10-14-runtime-comparison.json), [Node24 report](../evidence/2026-10-14-runtime-node24-full.json) and [Node26 report](../evidence/2026-10-14-runtime-node26-full.json). The [deterministic FakeWorker before/after record](../evidence/2026-10-14-headless-worker-ownership.json) shows old settledBeforeExit:true versus new false, with terminateCalls:1 in both. It proves the exit-wait ownership contract, not native WASM crash reproduction.

All 18 new targets passed (12 lifecycle and six diagnostic CLI tests), as did ten real related tests. Build,26 local-distribution checks (27.87seconds) and SKILL validation passed.

JOBSETTLEMENT1 implements execute-chain settlement tracking separately from early terminal state using executionSettled/resourceState and resource-state events. Release requires terminal plus settled execution; drain waits for currently pending executions only. This established resource-ownership contract does not prove V8 resolution.

State naming is pending/settled with releaseAllowed for retention release. This tracks executor completion after adapter cleanup, not browser OS-thread exit. Terminal-late rejection is separate executionError without distinguishing Abort from cleanup failure. Synchronous close stays compatible; drain/closeAsync and normal MCP EOF await settlement.

## 2026-10-14: post-repair recurrence in observation-profile testing

The initial full suite based on HEAD f7a2ea8 reported 584 tests: 580 passed, one failed and three skipped in70,927.9791 ms. Under the existing Node v24.11.1/V8 environment, the new MCP observation-profile test's MCP child exited2147483651, again recording `jit_page_->allocations_.erase(addr) == 1` and `UnregisterWasmAllocation`. Saved [recurrence evidence](../evidence/2026-10-14-observation-profiles-v8-failure.json) preserves the failure.

This independently demonstrates recurrence after Worker exit-ownership and settlement repairs; root-cause resolution remains unproven. The isolated retry passed one test and seven real jobs in3,715.4345 ms, without negating the initial stop. The unchanged-source full-suite retry passed581 and skipped three of584 in71,435.0784ms. All eight recorded source hashes still matched. A final regression after adding observation assertions to existing Worker tests is recorded separately. RUNTIMEWASM1 stays unresolved.

After adding observation assertions to three existing Worker test files, the final Node24 run again stopped with the same fatal in existing analysis-job-service.test.mjs. It reported583 tests:579 passed, one failed and three skipped in70,992.8209 ms. The lower count reflects process abortion, not reduced test coverage. Production sources were not changed for this rerun. Its isolated retry passed three tests in1,660.2976ms, without resolving recurrence or root cause.

The existing [failure evidence](../evidence/2026-10-14-observation-profiles-v8-failure.json) now includes this second failure as finalCoverageRun. The final-source full comparison on official QA portable Node26.10.0 passed581/skipped3 of584 without V8fatal (test175,036.3216ms,wall176,762ms). Its [raw report](../evidence/2026-10-14-observation-profiles-node26-full.json) and matching source SHAs including the additional helper are retained. This is not a performance benchmark or proof of identity with an upstream cause. Default Node remains unchanged. A passing comparison/retry does not negate the observed Node24 failures or establish resolution.

Read runtime from MCP studio_capabilities/diagnose_execution/preflight_project for allowlisted node/v8/platform/arch and known-environment warnings. Only exact observed matches report observed-risk; others are not-assessed, without root-fix/compatibility guarantees. This is separate from portable studioApi capability metadata.

## 2026-10-15: upstream findings and optional process containment

Checked2026-10-15. The [official Node issue66366](https://github.com/nodejs/node/issues/66366) reports a similar WASM-wrapper destruction race; [official V8 correction9b8ca54d5a](https://github.com/v8/v8/commit/9b8ca54d5a) describes atomic reference handling for dying wrappers. [Official Node v24.22.0 source](https://raw.githubusercontent.com/nodejs/node/v24.22.0/deps/v8/src/wasm/wasm-import-wrapper-cache.cc) still checks is_dying after AddRef in MaybeGet. These are source facts; identifying every repository fatal with the same root cause remains a hypothesis. Earlier alternate-runtime/isolated passes do not prove resolution.

Optional MCP --analysis-isolation=process places analysis in a same-executable Node child to contain native failure while retaining the host. Default worker,retry behavior and runtime selection are unchanged; no arbitrary executable is selected through wire arguments. Inspect bounded runtime-failure stderr/hash and wait for process-close cleanup. See [final validation](testing.md) and [runtime evidence](../evidence/2026-10-15-process-isolation-full.json). This is not V8 resolution or universal model compatibility.

This path reports code:ANALYSIS_PROCESS_EXIT on runtime-failure. Controlled exit86 tests do not reproduce an actual V8 fatal or demonstrate resolution. Parent-disconnect child cleanup is best effort and may be delayed by synchronous native work.
