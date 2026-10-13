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
