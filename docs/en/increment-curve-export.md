# Limited increment-curve artifacts

[日本語](../increment-curve-export.md)
 / [GUI instructions](increment-curve-ui.md)

The asynchronous pure service `createIncrementCurveArtifacts({spec,steps})` revalidates load/gauge data from independent linear-elastic solve outputs and returns `{curve,csv,json,svg}`. The last three are strings. It performs no file writes or DOM changes and never trusts a caller-supplied curve table.

Input is a dedicated increment bundle, not a normal Studio project JSON. `spec.input` hashes common specimen/material metadata; each load is checked against `output.calculation`, applied load and support reactions. Displacement control, plastic history, mixed material/mesh and maximum-displacement gauge substitutions are unsupported. It does not automatically create a process history.

CSV records N/mm/Pa/dimensionless units, status, provisional flags and input/mesh/calculation/result revisions per step. Engineering stress/strain use only the validated initial area and gauge length from the existing spec, never true stress or plastic strain. JSON is the reduced validated table, not a re-importable spec/steps bundle.

SVG is a static force–gauge-extension plot. Failed steps retain null numbers/empty CSV cells and break connecting lines. Provisional points are orange. Every artifact states `independent-linear-solves` and `plasticHistory:false`; an ascending/descending load sequence is not represented as plastic response.

Limits are1MiB UTF-8 JSON,128 steps,20,000 nodes, depth32,500,000 graph values,65,536 characters per string and2MiB per artifact. A synchronous JSON snapshot precedes hashing awaits. Only finite JSON data is accepted; accessors, cycles, non-JSON values and invalid XML characters are refused. SVG labels are escaped without external references. String CSV cells starting with whitespace followed by `= + - @` receive an apostrophe and quoting; negative numeric cells remain unchanged.

The [real-solver bundle](../evidence/2026-10-22-resultcurve-export-bundle.json) and [small reference proof](../evidence/2026-10-22-resultcurve-export-proof.json) use a10×10×40mm synthetic bar, E=1e9Pa, ν=0 and actual Gmsh/elastic solves at0/25/50/100/50/0N. At100N they reproduce0.04mm extension,1MPa engineering stress and0.001 strain. This is not a measured specimen. Saved results retain exact full nodal displacement, support reactions, applied load, residual and kind, omitting unused tensor/visual/performance arrays. Revisions are derived from the re-read saved subset.

Regenerate with `node scripts/create-increment-curve-export-reference.mjs`. Tests independently re-solve the saved mesh and verify CSV/JSON/SVG values and revisions, failed-step gaps, input immutability, tampering refusal, formula safety, XML escaping, extreme finite numbers and resource bounds. This is a bounded RESULTCURVE1 unit; it does not establish plastic material identification or arbitrary-result accuracy.

## Generate a re-input bundle from an explicit force route (2026-10-23)

`node scripts/create-increment-curve-bundle.mjs --request <absolute/request.json> --output <absolute/bundle.json>` solves an explicit force-controlled sequence one stage at a time with real Gmsh mesh generation and independent `solveElastic` calls, then writes a `{spec,steps}` bundle that the shared service can revalidate. `scripts/create-increment-curve-export-reference.mjs` uses the same bounded service.

The request is a dedicated JSON contract, not a normal Studio project. It requires `synthetic:true`, `curveId`, `caseIdentity`, `rowIdentity`, `boundsMm`, `meshSizeMm`, `youngModulusPa`, `poissonRatio`, a positive coordinate `axis`, `initialGaugeLengthMm`, `initialAreaMm2` and `loadsN`. The gauge length and area must match the box span and cross-section. `loadsN` holds1–128 values and preserves order, zero load, unloading and repeated loads. Each stage saves the displacement, support reactions, applied load and residual from that stage's own solve; no vector is scaled or copied from another stage, and no value is interpolated.

Request and output are distinct absolute paths, and an existing destination is never overwritten. Limits are64KiB per request,20,000 nodes and30,000 elements, ±1,000,000mm bounds, and the shared service's1MiB bundle bound. A generation, shared-service validation or publication failure leaves no complete destination file. A non-converged solve is retained as a `failed` row with no `output`; no converged row is fabricated. The result is neither a normal project nor the verified table JSON and is never applied implicitly to current GUI state. Generate table JSON, CSV and SVG separately through the shared service or `studio_increment_curve`.

For the synthetic10×10×40mm bar with E=1e9Pa and ν=0, the real solves reproduce0.04mm extension,1MPa engineering stress and0.001 strain at100N, and every saved vector is compared with an independent solve at the same load. This does not validate a measured specimen, plastic history, displacement control or arbitrary geometry.

`boundsMm` is `[xmin,ymin,zmin,xmax,ymax,zmax]` in mm. Studio/Gmsh boxes take an origin and dimensions, so the generator converts to `[xmin,ymin,zmin,xmax-xmin,ymax-ymin,zmax-zmin]` at that boundary. Each appended step is checked against the shared bundle budget before another solve starts.
