# Claude handoff (2026-10-15)

[日本語](../claude-handoff-2026-10-15.md)

## 0. Purpose

At the user's request, development in Codex stops here and Claude takes over. Codex-side development does not continue. This document separates confirmed facts from unconfirmed items (results pending). Never treat an unconfirmed result as passed.

## 1. Work location and Git state (confirmed)

- Working directory: the `case-comparison` Codex worktree (`.codex/worktrees/case-comparison/airpocket-simulation-studio`).
- Branch: `codex/case-comparison`.
- Implementation and verification target: `a24aaed5b10cb34e26c565115c5c7179ff05bcea` (pushed). Later commits only add the handoff document, evidence and follow-up work.
- Work directly inside this worktree.

### Handling the root checkout (strict)

- The repository root checkout is on `main` (`3fc7c97`) with the user's uncommitted changes in 5 files: `docs/printed-parts.md`, `src/board-strategy.js`, `docs/roadmap.md`, `docs/en/roadmap.md`, `src/progress.json`.
- Never overwrite, discard, mis-stage or switch branches there. Do not work in the root.
- MOD1 plan changes from the root have already been reflected in the feature worktree.

## 2. Implemented (confirmed)

- Case comparison unified in the shared module `src/case-comparison.js`: browser operation `caseCompare` and MCP tool `studio_compare_cases`.
- Catalog: 86 browser operations, 30 default MCP tools, 32 paired MCP tools.
- Spec: 1–8 saved cases, revisions/leases, raw units, explicit mode and frame, same global point, 64 KiB bound.
- Docs and the `CASECOMPARISON1` check are added. MOD1 stays queued.

## 3. Verification results

### Confirmed (run by Codex)

- Final full suite: 1033 tests, 1030 pass, 0 fail, 3 skipped. Local published-artifact check: all 28 items passed. Evidence: `docs/evidence/2026-10-15-case-comparison-local-runtime.json`. This verifies locally served artifacts, not the published HTTPS site.
- The earlier failure (tool-count expectation 31 vs actual 32) was fixed and retained in the logs under `.qa/`.

## 4. Remaining work

1. Browser UI QA of the real feature.
2. Post-publication QA.
3. Sync Skill references (keep unrelated Skill updates made by other agents).
4. Create the PR, attach Codex review if available, pass required CI, merge.
5. Confirm public deployment and the release tag.

## 5. Do not touch / constraints

- PR7 and PR13 are another owner's CFD draft work. Do not change, merge or interfere.
- `main` is protected: PR required, required CI is `verify`, up-to-date with latest main required. No bypass or admin override.
- The existing public-HTTPS test permission is inspect-only. Localhost MCP is `127.0.0.1:63727`. Do not widen to editing or analysis. Keep it distinct from local QA with your own synthetic data.
- Tests were run by Codex. Do not conflate them with Claude's coding/documentation work.

## 6. Product direction

- Specialize the user's own LLM through SKILLs; no own AI subscription.
- Core differentiators: the full API/MCP surface, specialist Skills, intermediate observations.
- MOD1 (shared TypeScript contracts, dependencies, independent screens/state, solver-adapter boundary) proceeds alongside API/MCP work, ahead of new physics.
- Introduce React/WASM incrementally; a full rewrite is not a release prerequisite. Follow the dependencies in `docs/roadmap.md`.

## 7. Recommended next minimal modularization

1. A limited shared type contract and a dependency-direction check.
2. Scoped solver-adapter and UI-state separation.

A folder move alone does not complete MOD1.
