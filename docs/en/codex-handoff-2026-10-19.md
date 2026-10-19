# Codex handoff — 2026-10-19

[日本語](../codex-handoff-2026-10-19.md)

This records the user's request to commit/push the current work and leave a handoff. The documentation branch is `codex/handoff-2026-10-19`, based on published main `d2d20c09b3dbbf568c596a503276c187267fc490`. This request adds documentation commits/pushes only; no additional merge or publication. Recheck Git and the published manifest when resuming.

Read this handoff first, then [current publication evidence](../evidence/2026-10-19-publication-d2d20c09.json), then the [critical path](task-critical-path.md). Read roadmap/progress/specific contracts only as needed for the selected existing task ID.

The user requests parallel subagents across development tasks and economical token use. Assign non-overlapping files, reuse existing evidence, avoid unnecessary confirmation stops, and carry meaningful development batches through verification, board updates and publication. For this handoff request, stop after pushing the documentation; do not begin another development batch.

## Confirmed publication

- [PR #125](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/125) is merged. Both PR/main CI recorded **1594 total, 1591 passed, 3 skipped, 0 failed**. Main `verify`, `deploy` and `verify-published` all succeeded.
- Published manifest revision matches main with `dirty:false`; the peeled `release-d2d20c09b3dbbf568c596a503276c187267fc490` tag and published progress/history head/hash agree. Use the [publication evidence](../evidence/2026-10-19-publication-d2d20c09.json). Older `release.testCount:1570` metadata is the PR124 baseline, not this candidate's final count or a failure.
- **171 tasks = 133 released + 38 unfinished: 19 queued, 14 building, 5 checking, 0 ready.** AGENTACP1/AGENTCHAT1/RESULTCURVE1/FINITEVISCO1 were reconciled from existing unpublished plans as four queued tasks, not a completion regression. [Reconciliation](../evidence/2026-10-19-planning-reconciliation.json). Parent epics and full product/Skill acceptance remain open.
- **13 repository/installed Skill files are synchronized, hash-matched and validated**: [evidence](../evidence/2026-10-19-skill-sync.json). Synchronization does not register or activate MCP tools. Current declarations remain 35 default/37 paired tools, 91 live operations and 3 minimal-connector tools. Discover tools actually registered in the conversation first.

## Three published increments

| Area | Verified scope and evidence | Remaining boundaries |
|---|---|---|
| REG2 sphere regions | Latitude/longitude sectors on one STEP/built-in sphere: selectSphericalRegion→stored dimensions→CAD fragmentation. Analytic areas, polar caps/full sphere/arbitrary frames, remeshing, 123N/37W conservation, real STEP Worker reaction and case JSON restoration. [Core](../evidence/2026-10-19-spherical-cad-region.json), [actual MCP/Chrome input persistence](../evidence/2026-10-19-preflight-gui-spherical-browser.json) | No new graphical selector. General UV/multiple solids/STL/fluid/spherical thermal contact unsupported. Browser file-chooser reimport, browser sphere solve and SolidCraft integration unverified. |
| VIEWCOMPARE GIF | Orbit/time/deformation, 24 fixed 640×320 RGB332 frames. Orbit i/24; endpoint-inclusive time/scale i/23. Integer delays total the requested seconds. Actual MCP/Chrome, external decoding, GUI cancel/restart and original four-state equality. [Evidence](../evidence/2026-10-19-comparison-time-deformation-gif-real-chrome.json) | Nearest stored physical frames only, fixed camera/range. Deformation is a visualization multiplier, not load history. Single-view GIF/MP4, general geometry and OS download completion unsupported/unverified. |
| UIIMPROVE1 preflight | Shared solve/mesh report, code/pointer/suggestions, focus to known inputs, stale-report invalidation. Chrome verified legacy labels, size repair, material section, EN→JA→EN and 390px. [Evidence](../evidence/2026-10-19-preflight-gui-spherical-browser.json) | completePreflight:false. Provisional:true/API no-mutation parity has unit evidence. Unregistered material drafts excluded; complete diagnostic translation and common six-case burden measurements remain open. |

See [sphere contract](reg2-curved-regions.md), [comparison](view-compare-design.md), [API/automation](automation.md) and [GUI correspondence](operation-correspondence.md). All three parent tasks remain building. No new physical threshold, relaxed tolerance or fabricated load history was introduced.

## Preserved old planning and workspaces

The primary checkout `D:/github/airpocket-soundman/airpocket-simulation-studio` retains the user's five dirty files unchanged: docs/roadmap.md, docs/en/roadmap.md, docs/printed-parts.md, src/board-strategy.js and src/progress.json. A temporary-index commit **`887d72ae18eb47d2c4ec14fd3ac26c64209b7a23`** was pushed to remote **`codex/planning-snapshot-2026-10-19`** without changing primary files, index or branch.

**That snapshot has an old PR12-era base. Do not merge/cherry-pick it wholesale into the current implementation.** Its planning intent and four added tasks were reconciled into PR125. Keep it for recovery/reference; PR125/main is authoritative.

- Documentation worktree: `C:/Users/yamashita_y00031/.codex/worktrees/thermal-compare/airpocket-simulation-studio`, branch codex/handoff-2026-10-19.
- Other worktree: `C:/Users/yamashita_y00031/.codex/worktrees/next-fluid-plan/airpocket-simulation-studio`. Inspect branch/status before use; do not mistake an older candidate for current main.
- Reuse existing dependencies/node_modules/CAD/WASM/build caches across the two worktrees where applicable. Avoid unnecessary clones, large downloads or blanket cleanup. Verify junction targets before deletion/moving. Cache reuse does not prove correspondence to a published SHA.

SolidCraft is updated to **0.16.1**. The user's request to remove obsolete releases does not authorize removing source repositories, CAD designs or settings. Studio integration remains unverified. A SolidCraft temporary-file cleanup was **rejected by automatic approval review: do not retry that operation or route around it through changed paths**. Do not report unperformed cleanup as successful. Studio QA owned-tab/bridge/dev/private-pairing-file cleanup is complete only within the recorded evidence scopes.

## Next priorities and remaining conditions

1. Read the [critical path](task-critical-path.md), [roadmap](roadmap.md) and current progress, then select a bounded acceptance unit under an existing ID. The next planning sequence builds ACP/conversation integration (AGENTACP1/AGENTCHAT1) and versioned load-stage data (RESULTCURVE1) on existing API/MCP/module boundaries. FINITEVISCO1 needs calibration/measurements and staged validation; existing J2/Neo-Hookean or display multipliers are not substitutes.
2. Input/diagnostic/repair work under AGENTINPUT1/UIIMPROVE1 can progress autonomously without closing P0–P6 or physical-validity acceptance. General REG2 surfaces and CFDPORT1 arbitrary wires/local lids/general volume joining remain outstanding.
3. CAD-only references for three permitted STEP representations already show existing subtraction returns one 512mm³ internal volume. Reuse tests/internal-fluid-step-connectivity-cad.test.mjs; do not add a speculative fuse helper as a completed feature without a public-path reproducer. Separate cavities and edge/point-only contacts remain unevaluated.
4. RUNTIMEWASM1 remains checking. Known Node24-family V8 fatals include `jit_page.has_value()` and `jit_page_->allocations_.erase(addr) == 1`. [Failure](../evidence/2026-10-18-runtime-jit-failure.json), [diagnostic comparison limits](../evidence/2026-10-18-runtime-comparison-smoke.json). Passing current CI or an isolated retry does not establish a root fix. Do not silently change runtime flags, skip tests or relax physics.
5. EXPORTBACKGROUND1 needs a genuine hidden-recording check; **the user cannot perform manual operations now**. Keep it waiting without repeated requests. Separate unit-tested watchdog/restoration from actual hidden-browser proof. Material/print measurements, registered SDK type projection, general geometry and public-connection conditions remain open.

## Actual-Chrome verification and cleanup

Use existing dependencies in the intended worktree, coordinate ports/CPU and freeze source before a **no-HMR localhost** run. An HMR-enabled attempt observed a page reset/case disappearance/detached command; a common cause has not been established.

Actual stdio MCP initialize/tools-list→GUI pairing→minimal necessary scopes→real tools is the reference route. Record artifact manifest/SHA, saved-input/case revisions and baseline input/cases/result/comparison settings; compare restoration after success/cancel/restart. Distinguish a Node-hosted semantic session from actual Chrome. Do not expand public HTTPS permissions beyond previous inspect-only evidence automatically.

Never print pairing codes, tokens, credentials, environment variables or secret temporary-file contents into documents/stdout/chat. Close only owned tabs/MCP/bridge/dev, record owned-job settled/release and secret-file cleanup. Retain uncertainty, timeout and automatic-review refusal honestly. This documentation request needs diff/link checks, not a new full test suite; root handles commit/push.
