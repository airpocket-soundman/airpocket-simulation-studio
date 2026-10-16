# API and saved-format compatibility policy

[日本語](../compatibility-policy.md)

Policy for the roadmap decision item "API version and saved-format compatibility" ([roadmap](roadmap.md)). Surveyed 2026-10-15 against the current loaders in `src/` and `tests/compatibility-future-version.test.mjs`. Behaviour listed here is a record of the present state; "known gaps" are items to fix later (no code was changed here).

## Rules

1. Additive changes (new optional fields) do not need a new version. Formats with strict key checks ("strict" below) reject unknown keys, so a writer that adds fields to them must bump the version.
2. Breaking changes (changed meaning, removal, unit change, or tighter validation that invalidates old data) require a new version number.
3. A loader refuses an unknown future version with a stable error (`Invalid ...`, or the project error `対応するプロジェクトではありません。`). It must never load partially, treat it as an older version, or fill defaults (no silent coercion).
4. Refusal happens before any state change (atomic). After a refusal the project, cases, display and histories are identical to before the load.
5. Loading an older version is allowed only with a written migration rule. The only rule today: importing a case/view bundle v1 into a measurement-history-capable host clears measurement history (`measurementsCleared:true`).
6. A response's `schemaVersion: 1` versions the output contract, not saved data. A breaking response change bumps `schemaVersion` and is reflected in `getBrowserOperationContracts`. Clients must not process an unknown response `schemaVersion`.
7. Version checks are exact (`!== 1`); no `>= 1` and no implicit string coercion.

## Format table

| Format | Version field | Older | Current | Future/unknown | Code |
|---|---|---|---|---|---|
| Saved project | `version` | n/a (0, missing and `'1'` refused) | 1: round-trips; unknown optional top-level keys are kept | Refused (`対応するプロジェクトではありません。`), state unchanged | `regions.js validateProject`, `studio-api.js loadProject` |
| Input provenance | `inputProvenance.schemaVersion` | none | 1 | Refused `Invalid input provenance document` (the whole `loadProject` is refused too) | `input-provenance.js` |
| Runtime identity | `runtimeIdentity.schemaVersion` | none (absent = legacy record) | 1 | Refused `Invalid runtime identity` | `runtime-identity.js` |
| Analysis assessment | `analysisAssessment.schemaVersion` | absent = legacy | 1 | Refused (saved-case validation mismatch error) | `analysis-preflight.js` |
| Saved-case reference | `caseReference.schemaVersion` | none | 1 | Refused `Valid saved-case source identity required` | `acoustic-input-contract.js` |
| Case archive | `version` | none | 1; each case re-validated on import | Refused `Invalid case archive`; a nested future `input.version` is refused too; whole-archive replace is atomic | `cases.js` |
| Named result view archive | `version` | none | 1 (strict keys) | Refused `Invalid named view archive`, archive unchanged | `named-result-views.js` |
| Measurement history archive | `version` (also `evidence.analysisAssessment.schemaVersion` in records) | none | 1 (strict keys, 300000-byte cap) | Refused `Invalid measurement archive`, history unchanged | `measurement-history.js` |
| Case/view bundle | `version`, `kind: 'case-view-bundle'` | v1 (no measurements) accepted; migrated to an empty history on capable hosts | v2 (with measurements; v2 refused on hosts without measurement history) | Refused `Invalid case view bundle`; future nested archive versions refused; replacement atomic | `case-view-bundle.js` |
| Case archive / bundle transfer (staging) | payload is the archive JSON above; the transfer itself is unversioned | per the archive | per the archive | refused at commit by the loaders above | `case-archive-transfer.js` |
| Analysis failure record | `schemaVersion` | none | 1 | Not refused: the structured failure is dropped and only the legacy message kept (known gap G1) | `analysis-failure.js` |
| Responses (read-only) | `schemaVersion` | n/a | 1 | Not a write target; clients do not handle unknown versions | `*-operations.js` |
| Shared API | `version: 1` in `studio-api.js` | n/a | 1 | Discover via `getCapabilities` / `getBrowserOperationContracts` | `studio-api.js` |

## Known gaps (present behaviour recorded; code unchanged)

| ID | Item | Present behaviour | Desired direction |
|---|---|---|---|
| G1 | Future analysis-failure `schemaVersion` | `restoreAnalysisError` ignores a record that fails validation and returns an `Error` with only the legacy message. No error is raised and the structured failure (`code`, etc.) is silently lost | Surface a future version with a stable warning or error |
| G2 | Unknown top-level keys of a case archive | `import` does not key-check the top level and silently drops unknown keys (absent from `export`). Nested versions are refused | Align with strict key checking, or preserve them |
| G3 | Added fields on strict-key formats | Named views, measurement history and bundles reject unknown keys, so even additive changes need a version bump | Bumping the version (rule 1) suffices; whether to add an extension area is undecided |
| G4 | Migration of older versions | Only version 1 exists; apart from bundle v1 to v2 there is no migration rule | Add the migration rule to this document when bumping a version |

`tests/compatibility-future-version.test.mjs` pins future-version refusal and immutability, current-version round-trips, and the present behaviour of G1 and G2 (`knownGap`). Update that test and this document together when fixing G1 or G2.
