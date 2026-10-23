# Node 24 / WASM teardown crash investigation

[日本語](../wasm-runtime-investigation.md)

## 2026-10-21: Fixed-source Linux comparisons completed; fatal not reproduced

Two manual workflow runs used the existing annotated tag `release-56576af6bd26d510c3166edf69c1cd73ffcb9703`, pointing at published source `56576af6bd26d510c3166edf69c1cd73ffcb9703`. Both run head SHAs match. The observed runtime was Linux x64 / Node **v24.22.0** / V8 **13.6.233.17-node.57**. The workflow still requests `ubuntu-latest` and `node-version: 24`; this investigation did not pin or change the production runtime.

| Target | Mode | Iterations | Pass/fail/skip | Test-child ms | Exit / signal |
| --- | --- | --- | --- | --- | --- |
| analysis-jobs | default | 1 | 8 / 0 / 0 | 3627 | 0 / null |
| analysis-jobs | disabled | 1 | 8 / 0 / 0 | 3754 | 0 / null |
| material-catalog | default | 1 | 7 / 0 / 0 | 3953 | 0 / null |
| material-catalog | disabled | 1 | 7 / 0 / 0 | 3788 | 0 / null |

[Analysis-jobs run 39543750219](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39543750219) and [material-catalog run 39543753492](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39543753492) succeeded. No cell hit its 30-second timeout, output cap, cancellation or signal termination. Allocation-erase and `jit_page.has_value()` signatures were each absent. Within each pair, concurrency 4, target tests, 269 source hashes, 16 resolved assets and the Node executable hash match. The only argv difference is the disabled mode's explicit `--no-wasm-code-gc` prefix.

The [summary and acceptance mapping](../evidence/2026-10-21-runtime-linux-comparison.json) retain environment, source/runtime fingerprints, exit/signal/timeout, test counts and stdout/stderr hashes per mode. [Unmodified downloaded originals](../evidence/2026-10-21-runtime-linux-raw/) retain each run's comparison JSON and default/disabled reports, including their raw stdout/stderr. GitHub artifacts expire after 14 days; retained file byte lengths and SHA-256 hashes are recorded in the summary.

After dispatch, takeover inspection found an earlier successful [material-catalog run 39542239219](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39542239219). Although its source is identical, it used Node **v24.21.0** / V8 **13.6.233.17-node.53** and passed seven tests in each mode. It is preserved as separate history and is not pooled with the current 24.22.0 pair's 30 tests. Only the two requested fresh runs were launched; no further repetitions were justified or performed after neither produced a difference or fatal.

**RUNTIMEWASM1 remains checking.** Non-reproduction in four cells establishes neither mitigation, root-cause equivalence, inclusion of a particular upstream fix, nor safety. These single runs execute default before disabled, do not control CI host load for a performance comparison, and do not measure RSS or memory cost. Diagnostic children remove `NODE_OPTIONS`; flag forwarding into separately spawned processes and termination of the entire descendant tree remain unproven. Confirmed close covers the owned diagnostic runner.

There is no basis here for changing product source, numerical tolerances, standard CI, default runtime/flags or task status. A future natural fatal still needs exact source/runtime and pre-exit Worker ownership checkpoints, separated by signature, before reducing a minimal real teardown sequence. Further bounded comparisons require a concrete reproduction or difference. The upstream issue/backport notes below are dated historical investigations; their current state was not refreshed by these runs.

Local validation reused existing WASM files read-only without a new runtime download, native build, full suite or Chrome work. Fifteen focused diagnostic tests and five contract declaration files passed. Fake/stub cleanup tests remain distinct from a native-fatal reproducer.

## 2026-10-18: Bounded diagnostic comparison

The first Linux/Node24.21.0 full verification of PR122 failed with `Check failed: jit_page.has_value()`; a same-source rerun passed. Record this separately from allocation-erase failures, without claiming a shared cause or a root fix.

`node scripts/compare-wasm-runtime.mjs 1 .qa/new-comparison.json --target=analysis-jobs --concurrency=4` compares default flags with explicit `--no-wasm-code-gc` sequentially using the same runtime/source/target. Outputs must be new; ordinary targets allow at most three iterations per mode and the full target allows one. The manual Linux workflow `WASM runtime diagnostic comparison` provides the same path. Ordinary tests and production launch flags are unchanged. Diagnostic children remove `NODE_OPTIONS`; separate spawned processes are not guaranteed to receive the flag.

Interruption and timeout request termination of the owned direct child, followed by bounded escalation and close confirmation. Descendant-tree cleanup is not guaranteed; unconfirmed close fails and stops comparison. The [single-run Windows smoke](../evidence/2026-10-18-runtime-comparison-smoke.json) completed both modes, establishing neither Linux reproduction nor mitigation or memory effects. Changed termination-control paths have unit coverage. RUNTIMEWASM1 remains open.

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

## 2026-10-15: Linux distribution-check recurrence and isolation scope

For main `badce2c0704385616af5c2dcc76898df85f833cb`, [publication CI run 38663202965](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/38663202965) passed the full tests and build on Linux Node v24.21.0, then `check-published --local` terminated with exit 133. Twenty-two named checks passed; after `project-and-case-roundtrips`, the log recorded `jit_page_->allocations_.erase(addr) == 1` and `UnregisterWasmAllocation`. This is not a pass of all 26 checks or a successful publication.

The next existing check initialized Gmsh in the verification parent itself to generate STEP references; later CAD-update reference generation also initialized it there. Timing and execution order are observed facts, not identification of the responsible instance or operation. The similar report in [official Node issue 66366](https://github.com/nodejs/node/issues/66366) and upstream V8 corrections provide comparison evidence, not proof of this application's root cause. Updating within Node 24 or citing earlier Node 26 passes does not establish resolution.

The verification plan uses the same Node executable in child processes to run the hash-verified distributed analysis/CAD modules and to generate STEP references. It preserves all 26 original checks, numerical tolerances and archive roundtrip assertions. It introduces no Node-version change, GC-disabling flag, skipped check, automatic retry or fallback. Receiving a result is insufficient: await child close and retain nonzero exits, signals and failures after result reception as verification failures.

Checkpoints record check and child execution starts and outcomes so evidence preceding a fatal termination survives even when JavaScript cannot catch it. Controlled real-child failures check parent survival, failure propagation and publication decisions; they do not reproduce the V8 fatal. See the current [testing record](testing.md) for complete distribution validation, Node/V8/platform/architecture, execution isolation and failure evidence. A successful isolated run remains separate from a root-cause fix.

The completion boundary covers one invocation of the selected distributed module's handler, its returned promise and child-process close. Abnormal exits observed through close are rejected. This does not verify arbitrary delayed work scheduled after handler completion or all cleanup during natural V8 shutdown; waiting one additional tick would not establish either guarantee. The [official Node v24.21.0 close contract](https://github.com/nodejs/node/blob/v24.21.0/doc/api/child_process.md#event-close) guarantees close after exit or a spawn-failure error. That differs from the absence of an exit guarantee after error: retain the error and wait for close.

## 2026-10-16: Minimal standalone reproducer and fixed-condition matrix (not reproduced)

`scripts/repro-v8-wasm-terminate.mjs` (no dependencies) repeats the trigger reported upstream in [Node issue 66366](https://github.com/nodejs/node/issues/66366): instantiate wasm on the main thread and in `worker_threads`, force tier-up with a hot loop, then `terminate()` the workers at short randomised delays. It uses a tiny wabt-assembled module (an imported-function call plus a memory store in a loop) and the real kernel `public/fem-kernel.wasm` (stub imports, instantiate only). Memory is switchable between shared (`{initial:1,maximum:1,shared:true}`, shared by main and workers) and non-shared. One cell is several parallel child processes times iterations, with 2 workers per iteration. Exit code, signal and stderr (Fatal / Check failed / `allocations_.erase` / `UnregisterWasmAllocation`) are classified; script errors (exit code 1 without a V8 signature) are counted separately as `harnessErrors`.

```powershell
node scripts/repro-v8-wasm-terminate.mjs --children=2 --iterations=50 --shared=1 [--module=tiny|kernel] [--flags="--no-wasm-code-gc"]
node scripts/repro-v8-wasm-terminate.mjs --matrix --cell-seconds=150 --output=<new.json>
```

Result ([docs/evidence/2026-10-16-v8-wasm-repro-matrix.json](../evidence/2026-10-16-v8-wasm-repro-matrix.json)): Node v24.11.1 / V8 13.6.233.10-node.28, Windows x64, Intel i5-9500 (6 cores), 5 parallel children, 150 s per cell. Seven cells (non-shared default, shared default, shared + `--no-wasm-code-gc`, shared + `--liftoff-only`, shared + `--no-wasm-tier-up`, non-shared + `--no-wasm-code-gc`, real kernel non-shared) ran about 108,500 iterations in total (14,028 to 17,458 per cell) with zero crashes and all exit codes 0. **Every cell is "not reproduced in roughly 14-17 thousand iterations", which does not show the problem is fixed or safe.** The fatal previously appeared in long-lived test processes (large code volume, code-GC pressure, many isolates), and this small module did not reproduce it. A match with the upstream trigger is therefore unconfirmed and the wrapper-cache race hypothesis is not verified by this experiment. With zero crashes in all cells, the flag cells cannot be compared. RUNTIMEWASM1 stays unresolved. Next candidates: hot-loop calls into the real kernel, larger code volume for code-GC pressure, and isolate count and parallelism comparable to the full test run.

### 2026-10-16 Crash isolation ([docs/evidence/2026-10-16-v8-crash-isolation.json](../evidence/2026-10-16-v8-crash-isolation.json))

Upstream nodejs/node#66366 is still open, and the backport PR #66376 (to v24.x-staging) is open and unmerged. The v24.22.0 changelog (2026-10-14) has no wrapper/is_dying fix, so neither 24.21.0 nor 24.22.0 contains it (retrieved 2026-10-16). In our code the MCP server defaults to worker_threads, creates a Worker per job and always calls `terminate()` after the result (`scripts/headless-analysis.mjs`), so one process repeatedly creates and terminates wasm-using Workers. That matches the upstream trigger shape, but it is a hypothesis from code reading and the upstream report, not a measured result. Measurement: on Windows (a heavily loaded host shared with other sessions) the five CI-failing test files ran 3 in parallel for about 330 s per config (Node 24.11.1, 24.22.0, 22.23.3, 26.12.0, and 24.11.1 with `--no-wasm-code-gc`), 93 runs in total, with 0 V8 fatals. At a rate well below 1 per 100 runs this cannot distinguish configs, and the non-V8 failures (job deadlines under load) are not comparable. Recommendation: the real fix is moving to a 24.x release that includes #66376. As an interim measure, `--no-wasm-code-gc` for the test run (separately approved; 0 failures in the upstream report, memory cost unmeasured). Running the MCP/job tests with `--analysis-isolation=process` is an untested option. Linux CI reproduction and a comparison of the options remain undone.


### 2026-10-24 PR193 isolated job-store diagnostic target

[CI run39984626501](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39984626501/job/120520481503), head `2041bea`, ended the existing `analysis-job-store.test.mjs` process after six successful subtests (18,859.18 ms; total2116, passed2107, failed1, skipped8). Retained spec logs contain no assertion stack, child exitCode/signal or V8 fatal/OOM attribution. The next declared test starts an actual analysis job without persistence, but its invocation position was not recorded. Neither a V8/OOM cause nor a new-feature regression is established. Six relevant test/store/service/FEM/worker blobs are identical at PR base and head.

The existing runner/workflow now accepts fixed target `analysis-job-store`. Mode `single` uses the existing `node scripts/reproduce-wasm-runtime.mjs 1 .qa/wasm-single.json --target=analysis-job-store` to run exactly this file once. Default Node flags/concurrency, TAP, exit/signal/timeout and before/after cgroup samples remain unchanged; existing comparison mode is retained. Shared cgroup OOM counters do not attribute a cause to a particular child. No test body, physical threshold, normal-CI/default Node/GC behavior or skip policy changed. Only lightweight selection/parser/stub regressions ran for this change; the parent will decide the Linux diagnostic dispatch, and no real solver was rerun here. [Investigation summary and six blobs](../evidence/2026-10-24-ci193-jobstore-diagnostic.json).
