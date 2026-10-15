# Claude handoff (2026-10-15 C)

[日本語](../claude-handoff-2026-10-15-c.md)

The user requested a handoff from Codex to Claude. No new Claude CLI was started. This is a snapshot; recheck GitHub and actual files before resuming.

## Constraints

- Specialize the user's own LLM through Skills. Do not build a proprietary AI subscription. All-feature API/MCP coverage, specialist Skills and intermediate-result pipelines take priority.
- Follow MOD1 and P0/P1/P3 before additional physics/solvers. The complete P0–P6 objective remains unfinished.
- Do not modify the D: root checkout. Five user drafts remain: `docs/printed-parts.md`, `docs/roadmap.md`, `docs/en/roadmap.md`, `src/board-strategy.js`, `src/progress.json`. Do not pull, switch, stage or overwrite there.
- Normal-merge only after required verify succeeds on the exact head containing latest main. Never bypass protection. The user authorized review and normal merging.
- Targeted tests do not prove broad completion. Publication requires verify/deploy/verify-published and actual deployed identity/integrity. Preserve failed runs and history.
- The user enters public-page pairing codes. Public connector authorization is inspect-only. Never expose tokens/codes in documents, logs or chat.

## Resume first

1. Main includes PR #38: `9716687b1492e25cd06eeeb809f3d4e8a7421cc1`. Publication run **38707143618** was running prepared tests when recorded. Poll this same run; do not assume it stopped.
2. Inspect latest head/CI of [Draft PR #40](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/40). This handoff, count fixes and failure evidence are being pushed there. Initial head `c1c431e` failed CI; corrected full success is unverified.
3. Finish PR40 full CI and real-Chrome verification of refinement/boundary preflight. Then mark ready, normal-merge after exact-head success, and verify publication.
4. Integrate the separately pushed GPU branch using the cautions below.
5. Continue public pairing, native-runtime investigation and the original P0–P6 requirements. Released task counts are not product completion percentages.

## PR/publication state

- #35: Worker observation ACK/transport limits and release audit. Published `a3b344c`; all three publication jobs passed. 109 released.
- #36: earlier reconciliation of 19 already-published tasks, 83→102; #35 then reached109.
- #37: real-Chrome full saved-view equality after reload/reimport, busy input reads and stale/page/scope refusals. Main `9f57d0f` passed28 published checks.
- #39: promoted those two tasks ready→released. Merged as `6f195bf`, but publication **38706323710** failed with native heap corruption; **that run did not deploy**.
- #38: fixed API-job progress leaving GUI status at “Solving…”. API events remain observable; GUI/direct progress remains intact. Real Chrome proved unchanged displayed result/input/status. Required CI **38706364224** passed on `e687e3a`, then normal-merged as `9716687`.
- Last verified public snapshot when recorded: `9f57d0f`, v0.44.0, 109 released/2 ready. Reaching111 depends on main9716687 publication. Check public JSON before claiming111.

## Worktrees

| Path | Branch/state |
| --- | --- |
| `C:\Users\yamashita_y00031\.codex\worktrees\case-comparison\airpocket-simulation-studio` | Primary: `codex/llm-input-operations`, Draft40; contains main9716687. Integrated head before handoff edits: `5b2844fdb1749edc04fdd3123235b913551876cd` |
| `C:\Users\yamashita_y00031\.codex\worktrees\mod1-wt\airpocket-simulation-studio` | `codex/mcp-tool-count-contracts`, `a220f71`, clean; changes already cherry-picked into primary |
| `C:\Users\yamashita_y00031\.codex\worktrees\handoff-wt` | `codex/postmesh-boundary-preflight`, `dbdbe7c`, clean; implementation already cherry-picked |
| `C:\Users\yamashita_y00031\.codex\worktrees\gpu-inspection-api\airpocket-simulation-studio` | `codex/gpu-inspection-api`, pushed `cad59a8ce272afeb408cb6d216b08d04b4e65bd2`, clean; not integrated, no PR |

`external-flow-su2` / `codex/cow-urans` and Draft7/13 are separate existing work, untouched.

## Draft40 implementation

### Post-mesh boundary transfer

Shared `src/mesh-boundary-preflight.js`, saved MCP `studio_preflight_mesh_boundaries`, live `meshBoundaryPreflight`, contracts and Skill guidance inspect `transferConditions` without solving. Require a successful execution-settled mesh-only job and exact input revision. Verify saved output bytes/SHA-256, refusing changed mesh bytes even when job ID/revision remain. Refuse asynchronous snapshot changes and preserve structured boundary diagnostics.

Static linear structure only. Always `completePreflight:false`; constraint rank, rigid-body modes, convergence and physical accuracy remain unchecked. Real CPU mesh/stdio/live-session tests exist; real Chrome execution of the new operation is still unverified.

### Selection-based refinement

`addSelectedMeshRefinements({size,radius,baseSize})` uses semantic edit/preview. GUI routes through the same API and existing `selectedRefinements` helper. At most80 additions/160 stored; local size15–100% of explicit baseSize. Preserve selection/existing settings; reject invalid/empty/stale/revoked requests atomically. This operation reuses existing MCP tools and adds no tool itself.

### Exact counts

After boundary preflight: **31 default tools /33 paired tools /87 browser methods**. Strict assertions and current bilingual docs were updated. Browser-only3/4 and historical evidence/handoffs remain unchanged. GPU adds another browser method: reconcile every affected assertion/current document after integration.

## Tests/failures to preserve

- Targeted integration:30 passed, including module boundaries, docs/progress, real CPU mesh and stdio/paired MCP.
- Local full `c1c431e`:1160 total,1142 passed,14 failed,1 cancelled,3 skipped;220716.9701ms. Fourteen strict-count failures; cancelled `analysis-process-worker` invalid-input real child test timed out at10s. Cause unproven; timeout unchanged.
- PR40 CI **38706588775** on the same head:1160 total,1143 passed,14 failed,0 cancelled,3 skipped. All14 were count assertions; the child test passed there.
- After count fixes/main merge at `5b2844f`:**34/34 targeted checks passed**, including the previously timed-out child. This does not prove the timeout cause fixed or the corrected full suite passing.
- Evidence: `docs/evidence/2026-10-15-input-operations-full-regression.json`. Raw primary logs: `.qa/llm-input-operations-full.log`, `.qa/llm-input-count-followup.log`, `.qa/pr40-initial-verify-failure.log`.
- Initial #38 CI **38705501050**:1155 total,1151 passed,1 failed,3 skipped. Corrected the old observer-failure test to explicit GUI origin, preserving error/cleanup/late-diagnostic assertions.32 targeted checks and later required CI passed. See `2026-10-15-api-progress-ci-regression.json`.

## Native heap investigation

Main39 run **38706323710**:1154 total,1150 passed,1 failed,3 skipped. `mcp-advanced-structural-provenance.test.mjs` emitted `corrupted size vs. prev_size`. Raw `.qa/main39-verify-failure.log`. This test does not call the new API. Do not attribute the crash to it or equate it with the separately known Node/V8 issue.

Eight MCP jobs already use process isolation; four comparison baselines use default Workers. Both paths wait for termination/close. Missing PID/phase information prevents identifying which path crashed. A possible limited mitigation is process isolation for only those four baselines; **not implemented**. Preserve existing Worker/process equivalence and default Worker coverage. Do not hide failure with skips, retries or production-default changes. Add PID/phase diagnostics if needed to investigate.

## GPU branch

Adds inspect-scope `checkGpuEnvironment`, empty-argument validation, actual browser observation distinct from capability declarations, expired/disconnected delayed-response refusal, device destruction and input/result invariance. Tests cover missing API/adapter, fallback and GPU responses.14/14 targeted tests passed; real Chrome/full suite unverified. Installed Skill is unsynced.

It starts from older main. Reconcile browser session, names/contracts, strict counts, current docs and Skill without dropping boundary preflight. The successor can choose integration into PR40 or a separate PR.

## Processes/cleanup

- Owned local QA disconnected, paired sessions verified zero, helper/Vite stopped, private settings removed and tabs closed. No listeners on5174/58354/58355. Local full session62163 and follow-up60785 ended. Delegates finished.
- **Existing public HTTPS connector remains**:127.0.0.1:62814, recorded listener PID28588. Private info: primary `.qa/connector-info.txt`; do not expose values. Revalidate PID/parent/command before reuse or stopping.
- PUBLICHTTPS1 has the user's “connected” report only. Independent inspect/disconnect/browser-version evidence remains missing. User enters the public code.
- Installed Skill has boundary/refinement references, not GPU. Recheck all repo/distribution hashes after integration.
- `.qa` contains ignored evidence and private settings. Do not indiscriminately delete or `git add -A`.

## Remaining scope

These API slices do not complete P0/P1/MOD1. Audit original roadmap/progress requirements: P2 measurements, P3 public pairing and real-Chrome Worker-transport verification, P4 reproducible exports, P5/P6 and other open work. Continue independent API/MCP/Skill work when a separate user-dependent check is waiting.
