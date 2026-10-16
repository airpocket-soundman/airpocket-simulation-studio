# Exact CAD patches on cylindrical surfaces

[日本語](../cylindrical-cad.md)

Enable Fragment the cylindrical CAD region under cylinder selection. Radius, axis, origin, axial limits, start angle and sweep define a patch on the actual cylindrical CAD face. Supports single STEP solids and built-in cylinders/tubes. The shared API also supports rotated and translated cylinders.

Angles follow the right-hand rule about the axis from the reference direction. With the Y axis and an X reference, positive angles move toward −Z. Wrapped sectors such as 315 degrees plus 90 degrees and full sleeves are supported. The sample fixes an end sleeve and applies 123 N to a central 90-degree, 20 mm patch.

Colored overlays follow the dimensional outline; mesh edges conform to angular and axial limits. CAD area is radius × angle in radians × axial length. The computational surface is faceted; area differences exceeding 3% are refused. Total force is conserved; pressure uses triangle areas and outward normals. Curvature area error and stress convergence require separate checks.

```js
studioApi.selectCylindricalRegion(0, {
  origin: [0, 0, 0], axis: [0, 1, 0], reference: [1, 0, 0],
  radius: 12, tolerance: 0.3, axialMin: -10, axialMax: 10,
  startDegrees: 315, sweepDegrees: 90, exactCad: true
});
studioApi.addCondition({type: 'force', value: 123, direction: [-1, 0, 0]});
```

## Cones (taper)

Adding `radiusAtMax` (radius at the axial end) makes the patch a conical face portion. `radius` is the radius at the axial start and the radius varies linearly with the axis. `exactCad: true` is required, the half-angle must not exceed 45 degrees and both radii must be positive. Area is angle in radians × mean radius × slant length. Construction uses the same revolve as cylinders and a wrong CAD radius is refused. The UI has a Cone radius at axial end field (blank for a cylinder). No new operation name exists; it is an optional field of `selectCylindricalRegion`.

```js
studioApi.selectCylindricalRegion(0, {
  origin: [0, 0, 0], axis: [0, 1, 0], reference: [1, 0, 0],
  radius: 10, radiusAtMax: 8, tolerance: 0.3, axialMin: -10, axialMax: 10,
  startDegrees: 315, sweepDegrees: 90, exactCad: true
});
```

Design: [reg2-curved-regions.md](reg2-curved-regions.md). Tests: tests/conical-wiring.test.mjs (OCCT fragmentation of a STEP cone, area, total and axial force, saved-case checks, wrong radius/range refusal).

Radial tolerance selects display triangles; incorrect CAD radius/bounds are refused. Up to twenty patches are supported, including planar rectangles. Arbitrary curved or spherical patches, multiple CAD volumes, fluid domains and thermal-contact patches remain unsupported. Existing dimensions without exactCad retain projection behavior.

Cases store dimensions and CAD/mesh areas and verify bounds/areas on restore. tests/cylindrical-cad.test.mjs checks wraparound, sleeves, rotated STEP, force conservation and reduced faceting area error with refinement. Worker tests verify force/reaction balance and archives. CAD construction uses [Gmsh OpenCASCADE revolve and fragment](https://gmsh.info/doc/texinfo/gmsh.html#Namespace-gmsh_002fmodel_002focc).
