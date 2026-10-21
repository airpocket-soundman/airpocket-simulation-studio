# Review of eleven additional PRs (2026-10-21)

[日本語](../opencode-next-pr-review-2026-10-21.md)

Independently reviewed exact heads for PR150–157 and159–161, accepting bounded increments. [Heads, verdicts and verification](../evidence/2026-10-21-next-pr-review.json). Parent acceptance remains separate:171total,134released,37unfinished.

- #150/#151/#152/#153/#155: accept limited helper, unit metadata, existing input guidance and artifact structure verification.
- #154: integration repairs an Infinity comparison bypass;34metadata paths times7invalid values are refused and a second reviewer approves the repair.
- #156: locale changes explicitly invalidate reports by design; the identity-cause hypothesis is unproven. Additional actual Chrome390px testing verifies required-pointer Tab/Enter focus, unchanged input, stale disposal and JP/EN rechecks.
- #157/#159/#160/#161: accept bounded Electron/Chromium and MCP observations; branded Chrome, independently decodable raw artifacts and cleanup evidence remain open.
- #159/#161: correct513 coordinate values to171nodes and2223 to741nodes. Preserve raw counts and remove the nonexistent field-mismatch claim.

Changed-code integration tests pass100/100. Individual tests and actual Chrome observations remain separately identified in JSON. Final full CI, normal merge and public verification are recorded by the publication stage.

[QA follow-ups46–51](../opencode-review-followups-2026-10-21/README.md) cover the six open checks. Original order26 incorrectly demanded focus on an unsupported disabled checkbox; it now separates safe refusal from focus in supported configurations. Do not enable unsupported controls to make QA pass.
