# Development progress

Discover the connected studio_progress schema first. The repository implementation accepts optional includeEstimate:true and includeHistory:true; omitted/false flags preserve the original progress response. Older registered servers may not accept these flags.

The opt-in envelope separates progress, estimate and history. Read only the requested insights. Estimate uses a versioned fixed-weight acceptance rubric with task-status assumptions, unknown elements and conservative/optimistic scenarios. It is not the released-task percentage, verified acceptance coverage, a statistical interval, physical validation or a delivery-date forecast. Report the rubric version and scope limits with the percent.

History contains committed src/progress.json snapshots with commit times and all six status counts. Inspect availability, source HEAD, shallow/truncated/skipped scope and additions/removals; do not invent absent history or interpret task growth as elapsed engineering effort. A source-byte mismatch or unavailable Git produces an explicit unavailable result. Node MCP history refers to its local checkout; it is not proof of the public deployment.

The management page verifies its history bytes/hash and progress identity inside the same published-manifest bracket. A historical gate's evidence pertains to its recorded candidate; it cannot certify a newer candidate. Use separate publication evidence for that claim.
