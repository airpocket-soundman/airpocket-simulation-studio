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
