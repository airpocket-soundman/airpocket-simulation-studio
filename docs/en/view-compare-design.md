# Synchronized multi-case view design note (VIEWCOMPARE, increment 1)

[日本語](../view-compare-design.md) / Related: [Result viewer and export requirements](result-viewer-direction.md)

Date: 2026-10-16. Only the pure computation module `src/view-compare-layout.js` (domain layer; no DOM, three.js or case store) and its unit tests are implemented. **No GUI, no PNG/video export and no MCP/API operations exist yet**; the VIEWCOMPARE board task remains open.

## Rules implemented

- `computeSharedRange`: builds a common colour range from the min/max of 2 to 4 cases. Cases with a different field or unit are refused (no shared scale across different quantities). Equal min and max are widened and reported as `padded: true`. The returned `colorRange` has the same shape as the existing view-settings `colorRange`.
- `resolveSharedTime`: given a physical time, picks each case's nearest stored frame. The signed offset in seconds is always returned and cases beyond the tolerance are refused. Cases without a time axis return `timeApplies: false`. No display interpolation.
- `sharedScalars`: validates the deformation scale (>= 0) and load factor once; every panel uses the same value.
- `layoutPanels`: integer rectangles for the output image. Two cases sit left/right, three or four use two columns. A label band sits above each panel and a shared legend band below. Rectangles do not overlap; sizes that are too small are refused.
- `panelLabel`: label lines with case name and conditions (name, value, unit). A condition without a unit is refused (write `1` for dimensionless).
- `planCompareView`: combines the above with one shared camera into a single plan.

## Not implemented / not verified

- Wiring two side-by-side views into the result viewer (`src/main.js`), collecting per-case value ranges, and synchronizing the shared camera.
- PNG/video export (connection to the existing visual-export), progress, cancel and state retention after reload.
- MCP/API layout and export operations, and the GUI operation-correspondence table and tests.
- Real-browser verification. Unit tests use synthetic data only.
- The load factor is only validated; it is not mapped to saved data or used to recompute results.

Next step: an adapter in the viewer collects each case's range and frame times, passes them to this module, and applies the resulting plan to each panel through the existing view-settings API.
