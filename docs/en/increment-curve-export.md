# Limited increment-curve artifacts

[日本語](../increment-curve-export.md) / [GUI instructions](increment-curve-ui.md)

The asynchronous pure service `createIncrementCurveArtifacts({spec,steps})` revalidates load/gauge data from independent linear-elastic solve outputs and returns `{curve,csv,json,svg}`. The last three are strings. It performs no file writes or DOM changes and never trusts a caller-supplied curve table.

Input is a dedicated increment bundle, not a normal Studio project JSON. `spec.input` hashes common specimen/material metadata; each load is checked against `output.calculation`, applied load and support reactions. Displacement control, plastic history, mixed material/mesh and maximum-displacement gauge substitutions are unsupported. It does not automatically create a process history.

CSV records N/mm/Pa/dimensionless units, status, provisional flags and input/mesh/calculation/result revisions per step. Engineering stress/strain use only the validated initial area and gauge length from the existing spec, never true stress or plastic strain. JSON is the reduced validated table, not a re-importable spec/steps bundle.

SVG is a static force–gauge-extension plot. Failed steps retain null numbers/empty CSV cells and break connecting lines. Provisional points are orange. Every artifact states `independent-linear-solves` and `plasticHistory:false`; an ascending/descending load sequence is not represented as plastic response.

Limits are1MiB UTF-8 JSON,128 steps,20,000 nodes, depth32,500,000 graph values,65,536 characters per string and2MiB per artifact. A synchronous JSON snapshot precedes hashing awaits. Only finite JSON data is accepted; accessors, cycles, non-JSON values and invalid XML characters are refused. SVG labels are escaped without external references. String CSV cells starting with whitespace followed by `= + - @` receive an apostrophe and quoting; negative numeric cells remain unchanged.

The [real-solver bundle](../evidence/2026-10-22-resultcurve-export-bundle.json) and [small reference proof](../evidence/2026-10-22-resultcurve-export-proof.json) use a10×10×40mm synthetic bar, E=1e9Pa, ν=0 and actual Gmsh/elastic solves at0/25/50/100/50/0N. At100N they reproduce0.04mm extension,1MPa engineering stress and0.001 strain. This is not a measured specimen. Saved results retain exact full nodal displacement, support reactions, applied load, residual and kind, omitting unused tensor/visual/performance arrays. Revisions are derived from the re-read saved subset.

Regenerate with `node scripts/create-increment-curve-export-reference.mjs`. Tests independently re-solve the saved mesh and verify CSV/JSON/SVG values and revisions, failed-step gaps, input immutability, tampering refusal, formula safety, XML escaping, extreme finite numbers and resource bounds. This is a bounded RESULTCURVE1 unit; it does not establish plastic material identification or arbitrary-result accuracy.

Re-enterable bundle generation from a force route: `node scripts/create-increment-curve-bundle.mjs --forces 0,25,50,100,50,0 --out <absolute path> [--size 4]`. It solves each step of a synthetic prismatic bar independently and writes `{spec,steps}` to a new file (an existing output is refused; the final name appears only after a complete write). A step without a converged solve is `converged:false` with no numbers and is never interpolated. Synthetic, linear, independent solves only; not a plastic history or measured evidence.
