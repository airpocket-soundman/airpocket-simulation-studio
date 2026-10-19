# REG2 curved-region extension design (cones, spheres, general surfaces)

[日本語](../reg2-curved-regions.md)

The remaining REG2 work ("apply dimensional regions exactly to CAD boundaries") is exact sub-division of curved faces other than planar rectangles ([planar-regions.md](planar-regions.md), [oblique-planar.md](oblique-planar.md)) and cylinders ([cylindrical-cad.md](cylindrical-cad.md)). This note records the survey, the smallest next increment, and its verification, limits, tests and risks. Conical patches are implemented (see Wiring result below); spherical sectors were added on 2026-10-19 (see below); general UV surfaces remain unimplemented.

## Current state (survey)

- Fragmentation lives in `fragmentCadPatches` (`src/cad-patches.js`). Planar patches are built from four lines; cylindrical patches by `makeCylinderPatch` (`src/cylindrical-cad.js`, Gmsh OpenCASCADE `revolve` of a generator line); both are embedded in the exterior faces with `occ.fragment`. Each patch area (`getMass`) is then compared with the formula at 1e-7 and checked to remain on the external boundary.
- `src/mesh-core.js` tags surface triangles with `patchConditions` and stores `planarPatches` / `cylindricalPatches` with `meshAreaMm2`. On restore, `validatePlanarMesh` / `validateCylindricalMesh` re-check bounds and area.
- `src/boundaries.js` judges area error at 1e-7 for planar and min(3%, tolerance) for cylindrical patches. Loads integrate triangle areas and outward normals, so total force is conserved.
- Selection uses `planarTriangles` / `cylindricalTriangles` on display triangles through `studioApi.selectPlanarRegion` / `selectCylindricalRegion`; `src/cad-update.js` reselects from the dimensions after a CAD reload.
- Limits: twenty regions in total, one CAD volume, no STL. Cones and spherical sectors are implemented; general UV faces remain unsupported.

## Candidates and recommendation

1. Cone: the same revolve construction as the cylinder with a linearly varying radius. Closed-form area, and the test confirms OCCT revolve yields one `Cone` face. Smallest and lowest risk.
2. Sphere (latitude/longitude rectangle): possible by revolving an arc; needs care at poles and the equator.
3. General UV rectangle on any face via OCCT UV bounds (`getParametrizationBounds`): works for any surface, but the area has no closed form and UV is not a length, so the dimensions are ill-defined.

Recommended order: cone, then sphere, then the general case. Cones and spheres share the surface-of-revolution frame and have analytic areas, so area error can be verified strictly. The general UV rectangle comes last because its dimensional meaning is unclear.

## Built in this increment (kernel)

`src/conical-cad.js` (added to the domain layer in `src/module-layers.json`) and `tests/conical-cad.test.mjs`.

- `validateConicalPatch(d)`: checks origin, axis, reference, `radius` (axial start) / `radiusAtMax` (> 0), axial range, start angle and sweep; reuses `cylindricalFrame`.
- `conicalPatchArea(d)`: angle (rad) x mean radius x slant length; equals the cylinder formula when the radii are equal.
- `conicalPatchPoint` / `conicalPatchContains`: points on the patch and containment, including wrapped angles.
- `makeConicalPatch(g, d)`: same revolve as the cylinder. Tests confirm the face type is `Cone` and `getMass` matches the formula to a relative 1e-9 on a built-in cone.

## Wiring result (implemented)

To avoid changing the public contracts (operation names and input pointer lists), no new `selectConicalRegion` was added. Instead the `selectCylindricalRegion` spec accepts an optional `radiusAtMax` (`radius` is the radius at the axial start; `radiusAtMin` is not used). `cylindricalFrame` validates it (positive radii, exactCad required, half-angle at most 45 degrees) and `cylinderPatchArea/Point/Contains/makeCylinderPatch` dispatch to the cone. Boundary transfer, mesh storage, restore checks, CAD update and the UI reuse the cylindrical path unchanged. See [cylindrical-cad.md](cylindrical-cad.md). The text below is the original API proposal.

## Original API proposal

```js
studioApi.selectConicalRegion(0, {
  origin: [0, 0, 0], axis: [0, 1, 0], reference: [1, 0, 0],
  radiusAtMin: 12, radiusAtMax: 6, tolerance: 0.3,
  axialMin: -10, axialMax: 10, startDegrees: 315, sweepDegrees: 90, exactCad: true
});
```

Scope: `conicalTriangles` (display selection), a `type:'conical'` branch in `fragmentCadPatches` (confirm a `Cone` face exists), `conicalPatches` stored by `mesh-core`, `validateConicalMesh`, the 3% cap in `boundaries.js` as for cylinders, reselection in `cad-update.js`, validation in `regions.js`, `project-input.d.ts` and the UI. The twenty-region cap is shared.

## Verification

- Area error: CAD area within 1e-7 of the formula (the kernel is checked at 1e-9). Mesh area is a faceted approximation, so the same 3% cap as cylinders applies and refinement must improve it monotonically.
- Load conservation: total force equals the requested value; pressure integrates triangle area and outward normal; force/reaction balance is checked as in the cylinder test. Because cone normals tilt against the axis, the axial reaction component is also checked.
- Persistence: dimensions, CAD area and mesh area are saved; bounds and areas are re-checked on restore; boundaries survive remeshing.

## Limits

- Both end radii must be positive (an apex, radius 0, is a singularity and excluded).
- General UV faces, multiple CAD volumes, fluid domains, thermal-contact patches and STL remain unsupported; spherical sectors are described below.
- The 3% cap judges mesh approximation only; it does not guarantee stress convergence.

## Test plan

1. Kernel (done): area formula and cylinder reduction, containment, invalid input refusal, OCCT revolve face type and mass.
2. On wiring: fragmentation on built-in and STEP cones, wrapped angles, full sleeves, refusal of wrong radius/range, area error shrinking with refinement, total force and reaction balance, case save/restore, reselection after CAD update, the worker path.
3. If spheres follow: ranges across a pole and the equator, checked against R²·Δλ·(sinφ2−sinφ1).

## Risks

- STEP cone faces carry rounding in axis and half-angle; containment tolerance should be backed by a `getClosestPoint` check on the face (as done for planes).
- Revolve may split the face or degenerate near the apex; refuse unless exactly one face results (as for cylinders).
- Cone display triangles tilt against the axis, so the cylinder normal test (axis dot at most 0.25) cannot be reused unchanged.
- A general UV rectangle may not satisfy "defined by dimensions" because UV spans are not lengths.

## Spherical latitude/longitude sectors (2026-10-19)

Use `selectSphericalRegion(meshIndex, spec)` through semantic `edit`/`previewEdit`. There is no new graphical sphere-region selector. Supported geometry is a spherical face on one built-in `sphere` or STEP solid, not a general UV rectangle.

```js
{ exactCad: true, center: [0,0,0], axis: [0,0,1], reference: [1,0,0],
  radius: 10, tolerance: 0.01, latitudeMin: -30, latitudeMax: 30,
  startDegrees: 315, sweepDegrees: 90 }
```

Lengths are mm and angles degrees. Latitude is measured from the equator about the polar axis: `-90 <= latitudeMin < latitudeMax <= 90`; longitude sweep is `0 < sweepDegrees <= 360`. The nonzero axis is normalized; reference is projected perpendicular to it and normalized. Zero/parallel/nonfinite frames, nonpositive radius and numeric overflow are refused. Nonnegative tolerance applies to display-vertex radius error only; it does not relax analysis CAD checks.

An OCC revolved meridian arc constructs a Sphere face for existing fragmentation. Exact area is `R² Δλ (sinφmax − sinφmin)`; the example gives157.07963267948966 mm². Conditions retain `sphericalRegion`; analysis meshes retain `sphericalPatches` and triangle `patchConditions`. Remeshing, condition reapplication and dimensional CAD-update reselection use the same recipe. JSON restoration checks dimensions, CAD/faceted area and both directions of triangle-label correspondence. Equivalent object-key ordering is accepted; value changes are refused.

Existing CAD area matching at1e-7 and curved faceting error min(3%, tolerance) remain unchanged. Specified total force/heat power are conserved. Per-area loads such as pressure/heat flux retain existing triangle integration, not exact curved integration or a stress-convergence guarantee. The shared 20-region/single-solid limit remains; STL, fluid domains and spherical thermal contact are unsupported.

[Machine-readable evidence](../evidence/2026-10-19-spherical-cad-region.json) and `tests/spherical-{cad,wiring}.test.mjs` cover arbitrary frames, wrapped longitude, north/south caps/full-longitude bands/full-sphere CAD areas, two mesh sizes,123N/37W conservation, a STEP sphere through the real Worker, reaction and case JSON restoration. A coarse cap's5.1% error is refused before accepting refinement. Actual stdio MCP schema discovery→preview/edit→saved-input retention is also covered. SolidCraft0.16 integration, deployed Worker and a new graphical selector are unverified; general UV surfaces remain unsupported. REG2 remains building.

Actual paired stdio MCP inspect/edit selected 418 sphere display triangles at 157.07963267948963mm² and stored a 123N condition/descriptor. Bounded GUI JSON-text retrieval followed by saved-file MCP reload preserved input revision and descriptor. Browser mesh/solve, a new graphical selector, download completion and file-chooser reimport remain unverified.
Browser subset evidence: [paired Chrome/saved MCP](../evidence/2026-10-19-preflight-gui-spherical-browser.json).
