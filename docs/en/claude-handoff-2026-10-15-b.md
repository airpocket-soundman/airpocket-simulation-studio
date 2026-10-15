# Claude handoff, part 2 (2026-10-15 evening)

[日本語](../claude-handoff-2026-10-15-b.md)

Continuation of the [previous handoff](claude-handoff-2026-10-15.md), written because the usage limit is near. Confirmed facts and unconfirmed/held items are kept apart. Do not treat an unverified result as passed.

## 1. Constraints (strict)

- The repository root checkout is on an old `main` (3fc7c97) with the user's uncommitted changes. Never touch it; work in the worktrees below.
- `main` is protected: PR required, required CI `verify`, up to date with main, no admin bypass. The user added a permission rule for `gh pr merge --merge`; merge normally only after `verify` has passed on the LATEST commit (`gh pr checks <n>`).
- PR #7 and #13 belong to another owner (CFD). Do not change or merge them.
- Never type a pairing token into the PUBLISHED HTTPS page, even if asked; only localhost test values for the user's own app are allowed. The user performs the published-page check.
- Real-Chrome evidence is localhost only (`http://127.0.0.1:5174`). Never write secrets to chat, the repo or evidence (`.qa/` is gitignored).
- Keep a single owner of `src/progress.json`; change states via `npm run task:status` or a validated Node script (`validateProgress`).
- Docs need both `docs/<name>.md` and `docs/en/<name>.md` with reciprocal links (`tests/docs.test.mjs`).
- Report only measured results. `ready` means verified, not released; documentation alone never moves a task to `released`.

## 2. Worktrees and branches

| Location | Branch | State |
|---|---|---|
| `...\worktrees\case-comparison\airpocket-simulation-studio` | `codex/release-v0.44` | v0.44.0 release-label preparation by the release-prep agent; UNCOMMITTED changes |
| `...\worktrees\mod1-wt\airpocket-simulation-studio` | `codex/evidence-chrome-4` | chrome-evidence-4 running; untracked evidence JSON accumulating; vite on 5174 probably running |
| `...\worktrees\handoff-wt` | `codex/handoff-b` | this document |
| `...\worktrees\external-flow-su2\...` | `codex/cow-urans` | another owner; do not touch |

Open PRs: **#26** (board re-audit, ready 23→27, `verify` was running), #7 and #13 (other owner).

## 3. Reached today (confirmed)

- Published app is still v0.43.0 (revision 7e496f6 at PR #24; it advances with each merge). Every merge produced an annotated tag `release-<revision>` and passing verify/deploy/verify-published.
- PRs #14–#25 merged: real-Chrome case comparison QA; MOD1 slices 1–10 (boundary check, TS declarations, solver-adapter registry with validate/buildOptions/adaptive/skipsBoundaryTransfer/postprocess hooks, UI splits); connector 403 CORS for the exact Origin and a `delivered` flag on timeouts; named-view 1-ULP fix (`canonicalViewState`); empty short-clip WebM fix; 3MF import fix above 3.25 MB (`isCanonicalBase64`); assessment API wording; PERF1 Node harness; CAE UI research doc; capacity and CI evidence.
- The published board (`development.html?lang=ja`) shows **20** in "waiting for next version (ready)" (verified candidate by bytes/SHA-256); 27 expected after PR #26.
- Latest full suite: 1112 tests, 1109 pass, 3 skipped. Local Node 24.11.1 intermittently hits a V8 fatal (`jit_page_->allocations_.erase`, nodejs/node#66366, unfixed in 24.x); CI `verify` has passed every time.

## 4. Board state

- Published: released 83 / ready 20 / checking 24 / fixing 1 / building 9 / queued 25. After #26: ready 27 / checking 17.
- New task **PUBLICHTTPS1** (verify the local connection from the published HTTPS page in a real browser); the published-HTTPS clause was removed from other tasks (user decision).
- `fixing`: WAVECHANNELOBS1. Awaiting the Node 24 gate policy: HEADLESSLIFECYCLE1, BROWSERCONTRACTS1 (RUNTIMEWASM1 related).
- 72 tasks carry a note that quoted test counts are as-of-recording (numbers unchanged).

## 5. In flight (check first on resume)

1. **PR #26**: confirm `verify` on the latest commit, merge, then confirm publication (manifest revision, tag, published ready count).
2. **release-prep output** (case-comparison tree, uncommitted): review the diff and the `release` description (facts only, limits stated). **Get the user's OK on v0.44.0 and the description before merging.**
3. **chrome-evidence-4** output (mod1-wt): real-Chrome evidence for BROWSERBRIDGE1 / RESULTCONTROL1 / CADUPDATEAPI1 / CASEARCHIVE1 (`docs/evidence/2026-10-15-*-real-chrome-4.json`); confirm vite and its drivers are stopped, then put the evidence in a PR.
4. **Published-page connection test**: the user is testing; result unknown. A connector (`--browser-origin=https://airpocket-soundman.github.io`) is still running; connection info is in `case-comparison\.qa\connector-info.txt`. So far the diagnostics show the browser's requests never reached the connector (suspects: Chrome Local Network Access permission or the service worker). Stop the connector and delete the file when done.
5. Cleanup: leftover `studio-mcp`/vite processes and merged worktrees (`git worktree remove`).

## 6. Next steps (suggested order)

1. Handle 5-1 to 5-3.
2. Version PR (v0.44.0) → publish → publication-record PR (`docs/evidence/…-publication-<revision>.json`, `ready` → `released`). Do not release PUBLICHTTPS1 or the publication gates.
3. Ask the user for the Node 24 gate policy (Node version, test concurrency, other); then decide HEADLESSLIFECYCLE1 / BROWSERCONTRACTS1.
4. Missing real-browser evidence: MEASUREMENTHISTORY1 (history GUI/autosave unfinished), AGENTINPUT1 (all-physics preflight unimplemented), PRINTAPI1, CASEVIEWBUNDLE1/CASEMEASUREMENTBUNDLE1 (all result kinds in the real UI).
5. Continue MOD1 (more `main.js` splits, rest of the worker). MOD1 is not complete (no React/WASM migration).
6. BROWSEREXPORT1: fixed-frame, MP4/GIF and persistence unfinished; exports stall in an undriven tab (timer throttling) and are not addressed.

## 7. Known issues

- Windows Node 24.11.1 V8 fatal: one test file occasionally fails in a full run, passes alone.
- `tests/browser-bridge.test.mjs` "real HTTP polling client…" can fail under full-suite load (5 s child start wait), passes alone.
- Published-HTTPS → localhost connector connection unverified.
- In the Claude desktop built-in browser pane Gmsh meshing stalled (fine in real Chrome); use real Chrome.

## 8. Resuming tips

- Parallelism: separate write scopes per agent, never let agents edit `src/progress.json`, use only one real-Chrome agent at a time and never alongside an agent editing `src` in the same tree; use separate worktrees.
- Real-Chrome evidence: a scratch Node driver spawns `studio-mcp.mjs --browser-origin=http://127.0.0.1:5174` over stdio, reads the `Browser connector:` JSON from stderr, and fills the page's connection UI (`#agent-endpoint`, `#agent-token`, `[data-agent-scope]`, `#agent-connect`). Drivers live under the session scratchpad and may be gone.
- If `gh pr merge` is denied, do not work around it; tell the user.
- `git add -A` in a shared tree sweeps up other agents' untracked files; add explicit paths.

## 9. Not verified (do not count as passed)

- Published HTTPS page connection (PUBLICHTTPS1).
- Browser heap, background/minimised-window behavior, fixed-frame/MP4/GIF/time/slice/deformation/acoustic exports.
- Real-UI coverage of every result kind (Node-side measurement only).
- The V8 fatal's root cause (nodejs/node#66366 is a candidate; same cause for this repo's Windows failures is unconfirmed).
