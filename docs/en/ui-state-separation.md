# UI / state separation (MOD1 third slice)

[日本語](../ui-state-separation.md)

MOD1 is not complete. The slices below separate parts of the UI from main.js. Its large template and full lifecycle are still together, and no React (or other framework) migration is claimed.

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

## Fifth slice: fatigue UI
`src/ui/fatigue-ui.js` (`createFatigueUi`) now holds three fatigue functions moved out of main.js. Behavior is unchanged.

- `renderFatigueMaterial` (fills the material form from fatigue data) and `readFatigueMaterial` (reads it back)
- `renderFatigueResult` (the fatigue summary panel and the load-factor/cycles/correction inputs)

`$`, `document`, `getMaterialProperties` and `getLanguage` are injected; the module does not import main.js. `materialProperties` and `language` change over time, so getters are passed and read on every call. main.js creates the module right after `status` because `renderMaterial` runs early. `fatigueOptions` and `evaluateDisplayedFatigue` (which touch `lastAnalysis`), the conditions list, 3D selection and analysis execution stay in main.js.
`tests/ui-fatigue.test.mjs` checks it with a fake DOM. Real-browser behavior still needs separate verification.

## Sixth slice: material property form
`src/ui/material-form-ui.js` (`createMaterialFormUi`) now holds three material-form routines. Behavior is unchanged.

- `installFields` (creates the property inputs)
- `writeForm` (the form-fill and status-text part of `renderMaterial`, including the plasticity / hyperelastic / orthotropic precedence)
- `readForm` (reads the form on save; orthotropic and fracture data are kept by clone)

`$`, `document`, `materialFields`, `materialReadiness`, `readFatigueMaterial`, `getMaterialProperties` and `getLanguage` are injected; the module does not import main.js. Changing values are passed as getters. The fracture-UI refresh, dirty flag and discipline-visibility update in `renderMaterial`, plus the plastic-load-fraction cleanup, catalog reconcile and `api` calls in the save handler stay in main.js (call order preserved). 3D selection, analysis execution (`lastAnalysis`, `startJob`) and the worker are untouched.
`tests/ui-material-form.test.mjs` checks it with a fake DOM. Real-browser behavior still needs separate verification.

## Slice 7: study, adaptive and internal-domain forms
`src/ui/study-form-ui.js` (`createStudyFormUi`) now holds five functions that only read and write input values. Behavior is unchanged.

- `readBrowserStudyControls` / `writeBrowserStudyControls` (browser-study control fields; checkboxes use `checked`, others `value`)
- `restoreAdaptiveOptions` (restores adaptive-mesh settings, including defaults and percent conversion)
- `internalOptions` / `restoreInternalFields` (internal fluid domain enclosure, seed point and port planes)

`$` and `browserStudyControls` are injected; the module does not import main.js. 3D selection, `lastAnalysis`, jobs and the worker are untouched.
`tests/ui-study-form.test.mjs` checks it with a fake DOM. Real-browser behavior still needs separate verification.

## Slice 8: discipline controls
`src/ui/discipline-controls-ui.js` (`createDisciplineControlsUi`) now owns discipline-specific visibility and control availability updates. Behavior is unchanged.

- Shows the `[data-physics]` elements for the selected discipline and opens visible flow/Stokes `details` sections.
- When a run is not active, enables or disables the run button based on fluid-domain mesh-only mode and unresolved CAD conditions.
- Enables plastic load fractions only for structural plasticity and sets nonlinear step count to the number of entered load fractions.
- Disables WebGPU/MFEM for unsupported disciplines or nonlinear/modal structural settings, and falls back to `wasm-pcg` if one of those solvers is already selected.
- Disables and clears adaptive analysis for non-structural, nonlinear, modal or STL cases.

The module receives the `$`, `querySelector` and `querySelectorAll` DOM functions, plus a `getState()` getter for the changing discipline, conditions, material, source model, run state and solver selection. It reads that state on every update and does not import main.js. main.js creates the updater and calls it from the existing update flow.
`tests/discipline-controls-ui.test.mjs` adds four independent fake-DOM tests. Real Chrome on localhost also verified solver fallback when selecting thermal, opening flow settings, and disabling MFEM/WebGPU/adaptation for modal analysis; see the [source-snapshot evidence](../evidence/2026-10-15-mod1-discipline-ui-chrome.json). This does not verify analysis execution, every combination or public HTTPS pairing.

## Slice 9: measurement history panel and automatic saving
Added `src/ui/measurement-history-ui.js` (`installMeasurementHistoryUi`) and `src/ui/measurement-history-storage.js`. This covers the remaining MEASUREMENTHISTORY1 clauses "history GUI and automatic persistence". No browser operation was added (the operation count is unchanged).

- Panel (`#measurement-history`, right after the saved result views panel): lists history entries for the displayed result (point, field, value and unit, name, mode/frame), "Save current probe", remove, JSON export/import and clear-all. Entries bound to other result revisions are not listed; only their count is shown.
- Save, remove, export and import call `window.measurementApi` (the same validation and revision checks as the connector); validation is not duplicated. The main.js probe tool hands its point to `setProbe`, and saving is refused when the displayed result revision no longer matches.
- Automatic saving: keyed by result SHA in IndexedDB (localStorage fallback), same origin only, holding nothing but measurement archives (no credentials). The archive validator (100 entries / 300,000 bytes) is applied on write and on load; corrupt or other-revision data is ignored and removed. At most 20 revisions are kept. The page works when saving fails and a note says so. "Clear all history and saved copy" empties both the panel and the saved copy.
- Dependencies (`document`, `anchor`, `api`, `resultView`, `storage`, `translate`, `language`) are injected; storage is an async get/set/remove/keys adapter.
- `tests/ui-measurement-history.test.mjs` checks this with a fake DOM and fake storage. Real-browser verification is still required.

Japanese: [../ui-state-separation.md](../ui-state-separation.md)
