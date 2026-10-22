# Static comparison of independent increment curves

[日本語](../increment-curve-comparison.md)

The pure service `createIncrementCurveComparison({bundles})` accepts2–4 dedicated `{spec,steps}` bundles and returns `{comparison,csv,json,svg}`. The last three are strings. Normal Studio projects and caller-supplied curve tables/images are not accepted inputs.

Every bundle receives a strict JSON snapshot before the first await, then is independently revalidated by the [single-curve service](increment-curve-export.md). Duplicate curveIds are refused. Different materials, geometries, gauges and axes are allowed for comparison; each curve retains case/row identities, initial area/length, axis and input/mesh/calculation/result revisions. The service does not certify physical equivalence between specimens.

SVG has two vertically stacked panels: gauge extension inmm versus reaction-derived tensile force inN, then dimensionless engineering strain versus engineering stress inPa. Each panel uses a common scale across curves. Colour, line pattern and numbered legends identify the same curve in both panels. Engineering values come only from existing validated curve fields; no true stress or plastic strain is generated. Full IDs remain in titles/metadata; numbering distinguishes long IDs with identical abbreviated labels.

Lines never connect different curves and break at failed steps within each curve. Failed values remain null/empty CSV cells; provisional points are hollow. Curves without converged points remain present. CSV has one shared unit-labelled header and every curve's rows, including curveId, status and revisions. JSON is a validated table with `schemaVersion:1`, `kind:increment-curve-comparison` and a `curves` array, not a re-importable raw bundle.

Aggregate UTF-8 JSON is limited to2MiB including its wrapper; each bundle retains the existing1MiB/128-step limits. Each output artifact is limited to2MiB. Extra wrapper keys, accessors, sparse/decorated arrays, invalid XML characters and nonfinite values are refused. SVG escaping and CSV formula protection follow the single-curve service. No input, browser or file is changed.

Tests combine the real-solver10×10×40mm bar with a separately solved Tet reference using a different material and geometry. They verify complete single-curve/CSV/JSON agreement, both panels' fields/units and common scales, failed-step/curve boundaries, four curves, immutable snapshots, expanded-output limits and formula/XML handling. Every artifact states `independent-linear-solves` / `plasticHistory:false`; this bounded comparison does not complete RESULTCURVE1 or plastic loading/unloading history.
