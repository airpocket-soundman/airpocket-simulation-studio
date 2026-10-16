# Handoff to Codex (2026-10-16, from Claude)

[日本語](../claude-handoff-2026-10-16.md)

At the user's request Claude's work is paused and handed to Codex. This is a snapshot taken at main `26138f3` (the merge of PR #96). Recheck GitHub, the published JSON and the actual files before resuming; do not assert the numbers here. Earlier handoffs: [2026-10-15](claude-handoff-2026-10-15.md), [B](claude-handoff-2026-10-15-b.md), [C](claude-handoff-2026-10-15-c.md).

## Rules (unchanged)

- Do not touch the root checkout (`D:\github\airpocket-soundman\airpocket-simulation-studio`). Its five uncommitted changes (`docs/printed-parts.md`, `docs/roadmap.md`, `docs/en/roadmap.md`, `src/board-strategy.js`, `src/progress.json`) are the user's. Work in worktrees.
- main is protected: PR, required CI `verify` on the exact head, `gh pr update-branch` if main moved, then `gh pr merge --merge`. No admin bypass. After a merge check the publish run (verify/deploy/verify-published), the published `runtime-manifest.json` revision and the tag `release-<sha>`.
- #13 (URANS prototype) stays a draft by the user's decision. #7 is merged.
- Public HTTPS is inspect-only. Never put pairing tokens in docs, logs or chat (chrome-media once printed the token of an already stopped connector in its own output; single use, local, connector stopped, no harm).
- Do not fabricate results. Anything not checked in real Chrome is "unverified". Board `ready` means verified except public HTTPS; `released` needs a publication record.
- The video is on hold (`docs/en/intro-video.md`; the file lives outside the repository, about 49 MiB).

## State at recording

- The only open PR is #13 (draft). Released 125, ready 2 (CASEARCHIVE1, PUBLICHTTPS1), checking 4 (AGENTINPUT1, BROWSEREXPORT1, RUNTIMEWASM1, MCPARGUMENTTYPES1), building 10, queued 24. The last publication check was around #95 (`4b57373`); the publish runs after #96 are unchecked.
- The only running sub-agent is chrome-media (real-Chrome re-verification of PR #96, the thermal slider fixes). Its result is to be written to `docs/evidence/2026-10-16-thermal-slider-fixes-real-chrome.json` (uncommitted, in the p-d worktree). Its completion notice will not reach a new owner, so look at p-d.

## Merged today (summary)

| PR | Content |
| --- | --- |
| #7 | Opt-in SU2 path (explicit download, pinned SHA-256, not bundled, LGPL-2.1 notice). CFD1 stays experimental |
| #63, #76 | Fixed-frame PNG-sequence ZIP; `physicalRevision` (identical ZIPs across fresh solves; `resultRevision`, CAS and archive hashes unchanged) |
| #66, #73, #82, #88, #91, #92 | Case archive performance: canonicalJson reuse, immediate re-poll, bridge long-poll (~20x), memoised case store with lower retention and a 256 MiB budget (`CASE_MEMORY_BUDGET`), `at()/count()/names()` |
| #67, #71 | README restructured: English `README.md`, Japanese `README.ja.md`; display name "airpocket Simulation Studio" (engine identifiers unchanged); result images/GIFs/WebM in `docs/media` |
| #69 | Post-mesh checks: acoustic elements per wavelength, component anchoring |
| #74, #77, #86, #93, #96 | VIEWTIME: interpolation module, acoustic interpolated slider, opt-in thermal nodal snapshots (`thermalSnapshotCount`), thermal time slider, probe/export fixes |
| #75, #79 | REG2: design note, cone regions (optional `radiusAtMax` on the existing cylindrical region) |
| #83, #84, #89 | VIEWCOMPARE: layout module, two-case side-by-side panel, colour bar |
| #80 | NUMERICREFERENCE1: failure capture hook and a line-search baseline-norm snapshot (about 1% intermittent failure, 0 in 717 runs) |
| #78, #94 | Compressible CFD candidate survey (SU2/OpenFOAM/HiSA/Eilmer); V8 crash upstream status and isolation runs |
| #70 | Publication record `2026-10-16-publication-d268661.json`; six tasks released |
| #68, #81, #85, #87, #90, #95 | Evidence JSON and board notes |

Evidence lives in `docs/evidence/2026-10-16-*.json`.

## Real-Chrome method

A scratch Node driver spawns `studio-mcp.mjs --browser-origin=http://127.0.0.1:5174` next to `vite` (127.0.0.1:5174). The token reaches the page through the gitignored `.qa/conn-local.txt` and is never echoed. Localhost only. The built-in browser pane stalls on Gmsh meshing, so Claude in Chrome is used. Unselected tabs throttle timers and slow exports. Browser auto-translation rewrites dynamic text (it changed the first export frame's caption once).

## Unresolved and unverified

- **Thermal slider fixes (#96):** not yet checked in real Chrome (in progress). The compare panel ignores thermal snapshots. Thermal fixed-frame/time export is unsupported (the sequence machinery is acoustic-only).
- **VIEWCOMPARE:** video export, MCP/API operations, state retention after reload/cancel and comparison of truly different geometries are not built/verified.
- **REG2:** spheres and general curved faces (UV rectangles) not started. The condition text for a blank end radius on a cone is unchecked. A separate `selectConicalRegion` would change frozen contracts and was not done (user decision).
- **BROWSEREXPORT1:** `slice`, size-limit boundaries, a 120-frame success and MP4/GIF are unverified.
- **CASEARCHIVE1:** the `CASE_MEMORY_BUDGET` path is not reached on a real page (the 8-case cap fires first). A foreground/unloaded re-run and the published HTTPS check remain.
- **RUNTIMEWASM1:** V8 wasm wrapper-cache race (nodejs/node#66366). Neither 24.21.0 nor 24.22.0 contains the fix (backport PR 66376 unmerged). Our 93 local runs reproduced 0 times and the triggering operation of ours is not identified. Recommended: move the CI pin to a 24.x release with the fix. The interim `--no-wasm-code-gc` is a CI change that needs the user's approval. CI hit it once more today on PR #88 and passed after re-running the failed job (record failures, do not hide them).
- **AGENTINPUT1:** checks on real gmsh thermal/acoustic meshes, magnitude rules for fluid/orthotropic/nonlinear/modal inputs and mesh-quality/convergence checks remain.
- **MCPARGUMENTTYPES1:** needs the user's MCP re-registration and a registered-SDK type-generation check.
- **Board states:** VIEWCOMPARE, VIEWTIME, NUMERICREFERENCE1 and CFDRESEARCH1 progressed but are still queued (notes only). Revisit if appropriate.
- **README:** bundled media show the English UI. Japanese UI rendering is unchecked.

## Side effects and cautions

- One sub-agent ran `taskkill` on python.exe while aborting an MFEM build; unrelated Python processes in other sessions may have stopped.
- The same sub-agent downloaded portable Node 22.23.3/24.22.0/26.12.0 zips from the official distribution into a scratch directory and verified them against SHASUMS256.txt (hashes in `2026-10-16-v8-crash-isolation.json`). Nothing was installed system-wide.
- Fresh worktrees lack built MFEM/native assets, so a full local run shows a dozen-plus failures (CI passes). Run the prepare/build steps or limit to related tests.

## Cleanup

- Of the worktrees under `C:\Users\yamashita_y00031\.codex\worktrees\` (p-a to p-u, `p-lp`, `case-comparison`, `external-flow-su2`), those on merged branches may be removed. Keep `external-flow-su2` (for #13). Remote branches are deleted automatically by GitHub.
- The uncommitted evidence JSON in `p-d` (chrome-media output) should be taken in by a PR after the check completes, or discarded.
- Routine PR flow: create, `gh pr update-branch`, wait for `verify` success, `gh pr merge --merge`. Right after an update the checks may not be registered yet, so wait until pass or fail appears.

## Next candidates

1. Take in the PR #96 real-Chrome result and update the VIEWTIME board note.
2. Thermal snapshots in the compare panel and sequence export (generalise the acoustic-only machinery).
3. VIEWCOMPARE video export and MCP/API operations.
4. REG2 spheres and UV rectangles.
5. Publication check of the latest main (verify-published), then a new publication record and ready-to-released updates.
6. RUNTIMEWASM1: check a 24.x release with the fix; adopt `--no-wasm-code-gc` if approved.
