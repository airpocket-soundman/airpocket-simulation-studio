# Static increment curves

[日本語](../increment-curve-ui.md) / [Shared CSV/JSON/SVG service](increment-curve-export.md) / [Result viewer requirements](result-viewer-direction.md) / [Increment data contract](../../src/increment-curve-data.js)

Open **Static increment curves** beside the result/case controls. Paste a JSON bundle containing only `spec` and `steps`, or choose a JSON file, then press **Validate and show static curve**. File selection alone does not draw. This tool never applies or changes the current project, cases or analysis result.

Start with **Save sample JSON**, then choose that file. The [bundled sample](../../public/examples/increment-curve-reference.json) contains actual `solveElastic` outputs for a synthetic single Tet4: 0/10 N, a failed step, then 20 N. It is not a measurement, a general uniform-bar analytical validation or a plastic history. Its generator is `tests/fixtures/increment-ui-reference.mjs`.

The shared `createIncrementCurveArtifacts` service recomputes gauge extension and tensile force from actual nodal displacements, support reactions and input/mesh/calculation/result content, producing matching CSV/JSON/SVG artifacts. Bundles with self-reported `curve`, SVG or CSV fields, invalid units, support/gauge definitions or result identities are refused. The exported JSON is a reduced step table, not a bundle that can be imported directly again.

The static plot uses gauge extension in mm on the horizontal axis and reaction-derived tensile force in N on the vertical axis. CSV/JSON also carry engineering stress in Pa and engineering strain in 1. These are independent linear-elastic solves, not plastic or viscoelastic loading/unloading history. Failed steps break the line; their count is visible. Maximum displacement or maximum von Mises stress never substitutes for gauge/engineering stress-strain data.

Validation exposes three download links: CSV, JSON and SVG. The generated SVG Blob is shown as an image; supplied HTML/SVG is never inserted into the DOM. Editing input, selecting another file or failing validation discards previous previews and download URLs. Late file reads/validation cannot overwrite newer input.

Input is limited to 1 MiB of UTF-8 JSON. The shared service's step/node/depth limits also apply. Labelled controls, error associations and native details/buttons/links support keyboard interaction. The preview scales to narrow widths and download links wrap. Japanese/English switching does not recalculate or change input.

This is a bounded RESULTCURVE1 increment. Automatic generation from an analysis, plastic state history, nonlinear hysteresis, measured calibration and the full parent-task acceptance remain incomplete.
