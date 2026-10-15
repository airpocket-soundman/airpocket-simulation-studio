# UI / state separation (MOD1 third slice)

[日本語](../ui-state-separation.md)

MOD1 is not complete. Only the saved-case list UI was separated from main.js. No React (or other framework) migration is claimed.

## What moved
`src/ui/case-list-ui.js` (`createCaseListUi`) now owns, with unchanged behavior:

- Saved-case list rendering (`renderCases`) and refreshing the modal/thermal case selects
- Wiring of the save-result, export, import and show-as-text buttons
- `window.caseApi` (still `Object.freeze`d; re-renders the list after add/import/remove)

Dependencies (the `$` DOM getter, the case store, `status`, `viewCase`, input restore, latest-analysis getter) are injected; the module does not import main.js. main.js only constructs it and exposes `renderCases` and `window.caseApi`.

## What did not move
`viewCase` (restoring the 3D view), `caseOperations`, `caseBundleApi` and the session wiring, the conditions list, 3D selection and analysis execution remain in main.js, which also still owns state such as `lastAnalysis`.

## Verification
`tests/ui-case-list.test.mjs` checks rendering and wiring with a minimal fake DOM. Real-browser behavior still needs separate verification.

## Fourth slice: status line
`src/ui/status-ui.js` (`createStatusUi`) now owns the `status` function previously in main.js, with unchanged behavior:

- Fixed Japanese labels (`STATUS_LABELS`) for 15 known messages (out-of-range temperature table, insufficient constraints, cancellation, per-analysis progress, etc.)
- Anything else is delegated to the injected `localizeStatus` (`ui-errors.js`) and written to `#status` `textContent`

`$` and `localizeStatus` are injected; the module does not import main.js. The label table is now a frozen constant instead of being rebuilt per call. The `language` (i18n) state, the conditions list, 3D selection and analysis execution did not move.
`tests/ui-status.test.mjs` checks it with a fake DOM. Real-browser behavior still needs separate verification.
