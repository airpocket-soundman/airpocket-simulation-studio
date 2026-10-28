# Confirmed shutdown of the diagnostic stdio client

[日本語](../stdio-client-close.md)

`createStdioClient.close()` in `scripts/perf-browser.mjs` returns an idempotent Promise. It closes stdin, waits up to3000ms for owned-child exit/close, then waits2000ms after SIGTERM and another2000ms after SIGKILL if necessary. Only confirmed termination returns `{exited:true,terminated,escalated}`. Successful signal delivery does not prove exit. Missing confirmation rejects with `STDIO_CHILD_EXIT_UNCONFIRMED`. Ownership covers the directly spawned child, not a general descendant process-tree guarantee.

Closing rejects new RPCs, settles pending RPCs with `STDIO_CLIENT_CLOSED`, clears their deadline timers, and releases readline, owned streams and listeners. Already exited children receive no signals. Existing callers may continue ignoring the result of `await client.close()`. Startup failure uses the same cleanup. Windows spawning sets windowsHide:true and shell:false.

RPCs default to a30000ms deadline. `STDIO_RPC_TIMEOUT` does not prove cancellation of a remote operation. Never automatically replay a mutation after timeout; inspect lifecycle according to the public operation contract. Startup/RPC/three shutdown budgets accept explicit positive integer milliseconds up to120000, supporting short fake-child tests. Normal CLI/solver/physical settings remain unchanged.

Seven fake tests cover normal EOF, delayed SIGTERM exit, SIGKILL, refusal without exit, an already exited child, RPC timeout/disposal and startup failure. All32 tests including existing perf tests pass. An initial run without installed dependencies failed only the existing real-stdio startup test; after npm ci all passed. No test was skipped to manufacture success.

[Real shutdown evidence](../evidence/2026-10-24-stdio-confirmed-close.json): a separate one-shot metadata-only smoke on Win32/Node v24.11.1 returned sessions=[], closed normally in16ms, observed exit0/no signal and both exit/close events, and left zero owned active handles, zero stdout data listeners and all owned streams destroyed. No GUI pairing, solver execution or token printing/storage occurred. This does not retroactively certify an earlier evaluation's cleanup.

Independent review reproduced an asynchronous EPIPE from stream destruction after confirmed child exit: removing error listeners too early crashed the caller after close had succeeded. Transport errors on stdin/stdout/stderr and readline are now handled, with each stream guard retained until its actual close and then removed. If child exit remains unconfirmed and close refuses, only a child error guard remains until later close; no RPC/timer remains and failure is never reported as success. Four isolated subprocess cases cover late errors and guard removal.
