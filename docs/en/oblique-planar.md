# Rectangles on oblique planar faces

[日本語](../oblique-planar.md)

Enable Rotate rectangle coordinates and enter X/Y/Z rotation angles. The selected axis is the rotated face-normal axis. Face position is the distance from the origin along that axis in mm; range bounds use the other two rotated axes. Rotations apply in X, Y, Z order.

For example, choose Z, rotate Y by 30 degrees, set position to 40 mm and both ranges to 2–8 mm. This defines a 36 mm² rectangle on the end face of a part rotated 30 degrees about Y. Load direction is specified separately in global coordinates and does not rotate automatically with the rectangle.

Supports planar faces of single STEP or box solids. The complete rectangle must lie on one external CAD plane. CAD fragmentation makes the mesh conform to its edges. Whole-face rectangles are supported. Coordinates and dimensions are saved; restored UI rotation controls must agree with the stored physical frame.

The API also accepts an origin and two orthonormal in-plane axes.

```js
const a = Math.PI / 6;
studioApi.selectPlanarRegion(0, {
  frame: {
    origin: [40 * Math.sin(a), 0, 40 * Math.cos(a)],
    u: [Math.cos(a), 0, -Math.sin(a)], v: [0, 1, 0]
  },
  min: [2, 2], max: [8, 8]
});
studioApi.addCondition({type: 'force', value: 100,
  direction: [Math.sin(a), 0, Math.cos(a)]});
```

API frames without Euler metadata appear as Custom plane in the UI and can be reapplied. Choose an axis and position to make a new UI selection. Curved faces, multiple bodies and rectangular thermal-contact conditions remain unsupported.

tests/oblique-planar.test.mjs verifies a 30-degree STEP reference, 36 mm² area, load/reaction balance, full-face supports, rounded display coordinates and saved rotation metadata. Distribution/browser checks include the same STEP example. The [Gmsh API](https://gmsh.info/doc/texinfo/gmsh.html#Namespace-gmsh_002fmodel) projects points onto CAD planes and checks trimmed-face inclusion.
