# Dimensional rectangles on planar faces

[日本語](../planar-regions.md)

Specify a rectangle on an external planar face of a single STEP or box solid. Under Select a planar rectangle by dimensions, enter the normal axis, face position and minimum/maximum coordinates of the other two axes in mm. The other axes follow X/Y/Z order. On Z=40, X=2–8 and Y=2–8 define an area of 36 mm².

Select the rectangle and add a structural, thermal or acoustic condition. The yellow rectangle shows the actual region. Intersecting original display triangles are stored for selection, but their entire areas are not used in the calculation. The CAD face is fragmented along the rectangle edges so mesh edges conform to the boundary. Original CAD face identities are retained for other full-face conditions.

The rectangle must lie completely on one external CAD plane. Up to twenty rectangles are supported. Rotated coordinates support oblique planes. Curved faces, multiple bodies and rectangular thermal-contact conditions remain unsupported. Dimensions are reapplied at each remesh and CAD/mesh areas are verified. Total force is conserved; constraint/stress accuracy still needs independent mesh convergence checks.

The shared API supports the same operation.

```js
studioApi.selectPlanarRegion(0, {axis: 2, position: 40, min: [2, 2], max: [8, 8]});
studioApi.addCondition({type: 'force', value: 100, direction: [0, 0, 1]});
```

Projects and cases retain dimensions. Imports verify display coverage and saved mesh bounds/area and reject inconsistent data. Ordinary face/brush selection clears the dimensional selection.

This uses [Gmsh OpenCASCADE BooleanFragments](https://gmsh.info/doc/texinfo/gmsh.html#gmsh_002fmodel_002focc_002ffragment). Verification in `tests/planar-region.test.mjs` and `tests/worker-pipeline.test.mjs` covers 56 mm² CAD patches, conserved 100 N loads at different mesh sizes, STEP rectangles on X/Y/Z planes, reaction balance for a 36 mm² load, roundtrips and corrupted archive rejection.

[Oblique planes and rotated rectangles](oblique-planar.md)
