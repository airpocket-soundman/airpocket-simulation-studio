# Inspect 3MF and G-code

[日本語](../printing-import.md)

v0.43 adds a separate printing-data inspector. Import original 3MF geometry, Bambu settings and embedded plate G-code, or a standalone G-code file. Switch between original geometry and each plate, filter layers, orbit/zoom and export the extracted data as JSON. Applying layer/infill properties to structural analysis is a separate calibrated-material integration task. Filament names and infill percentages do not generate stiffness, anisotropy or strength.

Follow the [3MF Core specification](https://github.com/3MFConsortium/spec_core/blob/master/3MF%20Core%20Specification.md) for meshes, object trees, build/component transforms and units. Support Production Extension references across internal model parts, including mirrored winding. Read stored/DEFLATE ZIP and bounded single-disk ZIP64. Validate headers, CRC, references and sizes. Reject external URLs, unknown required extensions, cycles, invalid indices, encryption, split archives and mixed model-part units. Textures and beam-lattice extensions are not rendered.

Read Bambu `Metadata/project_settings.config`, `model_settings.config` and plate G-code, following the [official BambuStudio implementation](https://github.com/bambulab/BambuStudio/blob/master/src/libslic3r/Format/bbs_3mf.cpp). Preserve per-object metadata in the export. Unsliced projects may have no paths; toolpath-only packages may have no original geometry. Verify model and plate coordinate frames separately.

G-code supports linear G0/G1, G90/G91, M82/M83, G20/G21, G92 and tool selection. Extract positive-deposition moves with known endpoints. Exclude stationary priming and extrusion used to recover retraction; partial recovery places the start proportionally along the programmed move. This is a command interpretation, not a pressure/flow or actual printer-motion model. Homing/probing invalidates positions until explicitly set. Omit non-extruding arc travel and reject extruding arcs or unsupported coordinate systems. Record conditional Bambu branches as possible paths with `conditionalDepth`; do not determine which branch executed. No command is sent to a printer.

Store feature/layer/settings comments. If layer numbers are absent, classify by endpoint Z; this does not reconstruct nonplanar layer topology. Segment and commanded filament totals do not guarantee printed volume or mass.

Limits: 50 MB 3MF, 25 MB G-code, 150 MB total decompression/80 MB per part, 25 MB XML/5 MB settings JSON, 1000 files, 100 expanded meshes, 200000 triangles, 20 plates and 200000 total paths. Reading is on the CPU; large files may delay UI response. Browser performance is a separate validation task.

Tests cover modes/units, G92 continuity, retraction, transforms, mirrored winding, production references, exports, CRC, ZIP64 and malformed data. The synthetic reference has one mesh, 12 triangles, two layers and 12 paths with 12 mm commanded deposition. Four browser checks cover imports, layer selection, exports, refusal and language changes. On 2026-10-14, local reads also verified official Bambu `pa_pattern.3mf` (one mesh/12 triangles) and ZIP64 `flowrate-test-pass1.3mf` (nine meshes/6920 triangles). Those are unsliced calibration projects, not a guarantee of every Bambu version, device or extension.

Generate own fixtures with `node scripts/print-fixtures.mjs`; run `node --test tests/print-import.test.mjs`. Browser API: `window.printImportApi.loadGcode(text)`, `load3mf(Uint8Array)` and `getDocument()`.
