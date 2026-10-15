# Progress history and product completion estimate

[日本語](../progress-dashboard.md)

Specification of the “Progress history & estimate” view of the development board. Observations (measured Git history and task counts) are shown separately from the estimate (completion of the full product).

## Task counts over time (observation)

- The source is the real Git commits that changed `src/progress.json`. At build time `scripts/progress-history.mjs` uses only `git log` and `git show <commit>:src/progress.json` and records the count of each of the six statuses (queued, building, checking, fixing, ready, released) per commit time (`%cI`). No interpolated, guessed or synthetic points are created.
- Added/removed tasks are recorded as the difference of task-ID sets against the previous recorded point (up to 25 IDs per point plus the true counts). A renamed ID appears as remove + add.
- Shallow clones, the point limit (1000), unreadable commits (file absent, oversized, invalid UTF-8/JSON, invalid status or duplicate IDs) and timestamp regressions are recorded in `completeness` and `skipped` and shown as notices. Unreadable commits are never plotted.
- The artifact `progress-history.json` is bounded (2 MB, 1000 points, 200 skipped, 2 MB per snapshot, 256 MB total). `validateProgressHistory` checks structure, count sums and “total = previous total + added − removed”; inconsistencies are rejected, not repaired.
- Build order is `build-progress-history.mjs` → `build-manifest.mjs`. The history is registered in `runtime-manifest.json` `files` with bytes and SHA-256. CI checks out with `fetch-depth: 0` and `PROGRESS_HISTORY_REQUIRE_COMPLETE=1` fails a shallow checkout.
- The board reads history through the same candidate-pinned read as progress (`fetchPublishedProgress({includeHistory:true})`), between the two manifest reads, and shows it only when bytes, SHA-256, schema, `head.revision` and `head.progressSha256` match the verified candidate. A history failure never changes the progress verification; the history is reported unavailable with a reason code. Manifests published before history existed report `PUBLISHED_HISTORY_ABSENT`. The bundled initial record carries no history.
- Provided: a legend that toggles statuses, a commit slider (arrow keys), chart click, a detail panel and a collapsible table of every recorded point. Colour is never the only cue: each status also has its own dash pattern and marker shape. Lines hold the previous value between commits (step).

## Completion of the full product (estimate)

- The target is P0–P6 in `docs/roadmap.md`, the existing backlog, the common completion gates and the six publication-milestone gates. `PRODUCT_RUBRIC` in `src/product-estimate.js` holds 13 fixed criteria (weights sum to 100); each element links task IDs and a source document.
- Weights are judgments from the roadmap priorities (heavier for the pre-release priorities P0, P1, P3, P4 and the publication gates; lighter for P2, P6 and post-release work). They have no statistical basis.
- Element credit is (mean + minimum) / 2 of its tasks’ status credits, in three scenarios low/central/high (`STATUS_CREDIT`). A released task is 0.9 centrally and becomes 1 only when the whole scope is closed. An element no task tracks is “unknown”: 0 centrally (0.2 only in the optimistic case). A milestone gate scores full only when its status is `complete`; task status cannot close it.
- While scope is incomplete (unknown elements, unreleased P0–P6, open items, pending milestone) the displayed value is capped at 99%. The released-task ratio is shown as an observation and is not an input; adding or splitting tasks does not change the estimate.
- Limitations: task status is self-reported and evidence is not re-verified; a complete gate refers to its recorded candidate revision; this is not numerical-convergence or physical-accuracy progress, and no date or effort is forecast.

## Verification

`tests/progress-history.test.mjs` (extraction, schema, bounds, real git), `tests/product-estimate.test.mjs` (rubric, arithmetic, scope), `tests/published-history.test.mjs` (candidate-pinned read and manifest). Built assets are checked by `progress-history-candidate` in `npm run test:published -- --local`. Rendering and interaction require a separate real-browser check.

Review corrections: any skipped record disables connecting lines; show known points only, without forward-filling unknown intervals. Accept only Git CRLF conversion when binding exact displayed progress bytes to history; reject other uncommitted differences. Full gate credit requires verified/passed evidence matching the displayed candidate. Unknown acceptance requirements require a rubric revision linking evidence-bearing tasks before closure, preserving total weight 100. MCP studio_progress accepts optional includeEstimate/includeHistory while preserving its default response.

## Publication-state reconciliation

Successful CI or a merge to main does not automatically mark a task released. After publication, reconcile each task's own acceptance criteria and evidence with inclusion in the deployed revision. Promote verified tasks that satisfy those conditions in an evidence-backed PR. Keep items with unverified conditions, and partially implemented P0–P6/MOD1 plans, open. Do not duplicate requirements such as public pairing across every feature when they have explicitly been separated into their own task.

A batch audit of delayed status updates may create a jump in the released-count history. That increase is a status correction at audit time, not the number of features implemented or development speed during the same interval. Preserve the actual Git history and record the decisions and original publication evidence in the audit.
