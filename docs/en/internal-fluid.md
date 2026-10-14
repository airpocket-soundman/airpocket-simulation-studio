# Extract internal fluid from CAD

[日本語](../internal-fluid.md)

**Internal passage example** builds a CAD tube wall (outer Ø24, inner Ø16, length 60 mm), caps its ends with a box and keeps only the inner fluid. It then selects developed laminar flow, with editable pressure drop, viscosity and density.

## Using STEP

1. Import STEP containing closed solid CAD volumes.
2. Open **Extract internal fluid space** and specify a point inside the fluid.
3. Set box minimum/width and select the X/Y/Z faces that close openings. **Use model bounds for the box** supplies initial values; verify the actual openings meet those planes.
4. **Extract internal fluid domain** keeps the single CAD-subtracted volume containing the seed. Port buttons select entire cap surfaces.
5. CAD-verified straight circular/rectangular passages select laminar flow automatically. Other shapes support meshing only; general 3D flow is still unsupported. Acoustic analysis can instead apply pressure conditions on ports or walls.

Disable all ports for a sealed cavity. Solid/boundary seeds, leakage onto undeclared box faces and declared ports missing the selected volume are rejected. Caps are limited to axis-aligned box planes. Arbitrarily oriented openings, curved caps and joining fluid split across several CAD volumes remain outstanding.

## Geometry and physics

OCC subtracts actual CAD solids, rather than substituting their bounding boxes. `gmsh.model.isInside` classifies the seed; CAD boundaries, volume and areas are inspected. Original STEP/tube geometry remains in the project. Port tags, seed, CAD volume and excluded-volume count are retained in the mesh.

Recognition checks two opposing end planes, CAD surface types and volume/area consistency. Round passages require cylindrical walls and circular caps; rectangular passages require axis-aligned planar walls and rectangular-prism volume. Analysis wall coordinates are checked too. The [fully developed laminar model](analysis-guide.md) solves scalar axial velocity, excluding entrance development, bends, separation, inertia and turbulence. Re ≤ 1500 and Mach ≤ 0.1 are enforced. Linear tetrahedra facet curved surfaces; CAD/mesh volume and flux retain discretization error.

Round reference: radius 8 mm, length 60 mm, Δp=0.01 Pa, μ=0.001 Pa·s. Analytic peak is 0.0026667 m/s and flow 2.6808e−7 m³/s. Target size 2 mm gives 0.0027200 m/s, 2.5737e−7 m³/s and 0.0191% end-flux imbalance. Refining to 1.5 mm reduces flux error. Rectangular STEP passages are also checked against a Fourier-series reference.

## Shared API

Use `sourceModel: {kind:'fluidDomain', mode:'internal', solid: originalCAD, enclosure:[x,y,z,dx,dy,dz], seedPoint:[x,y,z], portPlanes:[...]}` in mm. Planes 0/1/2 mean X/Y/Z minimum; 3/4/5 mean maximum. Built-in tube walls use `{kind:'tube', center:[x,y,z], axis:0|1|2, outerRadius, innerRadius, length}`, extending half the length each side of center.

`mesh.domainSelection` retains `ports`, `cadVolumeMm3` and recognized `channel`. Archive imports check ports/geometry against input. UI and API share the same mesh/solver.

Reference: [Gmsh official API — isInside / OCC / getBoundary](https://gmsh.info/doc/texinfo/). Boundary layers, arbitrary caps, general 3D flow and conjugate heat transfer are separate tasks.

## Explicit-configuration API route

Call window.fluidDomainApi.prepare with mode:internal and explicit box/seed/portPlanes, run mesh to success plus executionSettled, then applyMesh to display its surface. Existing domains may reuse their original solid. Unlike automatic channel switching in GUI examples, this API keeps study.kind:fluidDomain and clears properties/conditions/selection/provenance/intent. Channel summary metadata alone does not automatically enable flow solving. See the [operation contract](automation.md) for revision/mesh checks.
