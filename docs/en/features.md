# Planned features

[日本語](../features.md)

Refer to the live board for implementation status; this list describes the target scope.

## Geometry and regions

STEP is the main input; STL is supplemental and lacks CAD-face identity. Inspect units and dimensions. Orbit, pan, zoom, standard views and focus on selected regions. Select entire planar, cylindrical or freeform CAD faces, multiple faces, parts or volumes. Use brush/erase, add/remove and undo/redo for partial regions.

Support dimensional regions such as a radius around a point or axial length and angle on a cylinder. Distinguish spatial radius from surface distance. Default to visible surfaces; explicitly enable through-selection where applicable. Add transparency, hidden parts and sections for internal surfaces.

Persist CAD references and region definitions independently of node indices. Split CAD faces or use an explicitly identified mesh approximation; report area/boundary errors and stop outside tolerance. Request reselection when CAD edits invalidate references.

## Structural

Constraints, directional restraints, prescribed displacement, total force, pressure and gravity with markers/arrows. Distinguish global/local/normal directions and check resultant force and moment. Start with linear static displacement, reactions, stress and strain. Add large deformation, plasticity, hyperelasticity, contact/friction, buckling, vibration, fatigue and failure later. Identify stress singularities rather than predicting fracture from peak stress alone.

## Thermal and fluid

Steady/transient conduction, temperature/flux boundaries, total and volumetric heat sources, convection and radiation; later contact resistance, temperature-dependent properties and thermal stress. Display temperature, flux, histories and energy balance.

Create separate fluid regions, internal passages or external enclosures; configure inlet/outlet/wall/symmetry conditions. Start with incompressible single-phase laminar flow. Show velocity, pressure, streamlines, pressure loss and mass balance. Add turbulence, unsteady flow, natural convection and conjugate heat transfer; compressible/multiphase flow is a later phase.

## Shared

Materials with sources/units/validity ranges; solver capability checks; mesh quality/local sizing/convergence; progress/cancel/logs/failure diagnosis; legends, units, probes, sections, deformed shapes and time histories. Preserve geometry, regions, material data, mesh, solver version/settings and results for each case. Support project/case duplication, comparison and reports. Acoustics and adaptive meshing have separate specifications.

### Cylindrical angle and length selection
Select display triangles using axis/origin, radius/tolerance, axial interval and start angle/angular span. Angles follow the right-hand rule; zero follows X (Y for an X-axis cylinder). End caps are excluded and rear triangles are included. This is centroid-based approximation, not exact boundary splitting. The last dimension preset is saved in projects and can be reapplied after clearing selection or restoring a project. UI supports X/Y/Z axes; studioApi.selectCylindricalRegion(mesh,spec) accepts arbitrary axis/reference vectors. spec contains origin, axis, reference, radius, tolerance, axialMin, axialMax, startDegrees and sweepDegrees. CAD update reconciliation and exact remesh conformity (REG2/CAD2) remain separate work.

### Display geometry inspection
Inspect surface reports open/non-manifold edges, winding conflicts, duplicates, degeneracies, connected components and dimensions in mm per part. Vertices are matched within max(1e-8 mm, bounding-box diagonal × 1e-7) by default without changing geometry. Up to 1000 defective triangles can be selected; counts include all defects. Limit: 300000 triangles per part. studioApi.inspectGeometry({toleranceMm}) shares the same inspection. Passing edge closure does not validate self-intersections, vertex manifoldness or exact CAD solids. Units follow import settings; verify displayed dimensions. Repair holes/duplicates in the original CAD/mesh editor and reload; no automatic repair is performed. Geometry defect example demonstrates inspection and selection.

Replace with selected region updates a registered condition region while preserving load values, direction and other settings. Conditions registered with a selection exactly matching cylindrical dimensions retain those dimensions. Reapply dimensional region recomputes selected display triangles and updates the condition after tessellation changes. This remains approximate surface selection, not CAD-face reconciliation or exact boundary splitting. An absent region leaves the original condition unchanged. APIs: replaceConditionRegion(index), reapplyConditionRegion(index).

### Section clipping, opacity and part visibility
Inspect inside sets an X/Y/Z clipping plane and retained side for setup models and analysis results. No new cap geometry is generated; select exposed original interior faces. Transparent front faces still intercept selection; hide parts to select behind them. Part visibility affects the setup viewer only, not analysis contents. Viewer settings are session-only and are not saved in projects. window.viewApi.get()/set({clipEnabled,axis,position,flip,opacity,hiddenParts}) shares the same controls. The interior sample overlaps 20 mm and 8 mm display-only parts. Browser validation selected 64 mm² inside after clipping, 400 mm² in front through transparency, and 64 mm² inside after hiding the outer part.

Exterior fluid-domain CAD subtraction and meshing are implemented. [Scope and usage](fluid-domains.md). General 3D flow solving and automatic internal passage extraction remain unsupported. Fully developed round/rectangular laminar channels are a separate limited mode.
