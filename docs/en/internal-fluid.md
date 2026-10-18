# Extract internal fluid from CAD

[日本語](../internal-fluid.md)

**Internal passage example** builds a CAD tube wall (outer Ø24, inner Ø16, length 60 mm), caps its ends with a box and keeps only the inner fluid. It then selects developed laminar flow, with editable pressure drop, viscosity and density.

## Using STEP

1. Import STEP containing closed solid CAD volumes.
2. Open **Extract internal fluid space** and specify a point inside the fluid.
3. Set box minimum/width and select the X/Y/Z faces that close openings. **Use model bounds for the box** supplies initial values; verify the actual openings meet those planes.
4. **Extract internal fluid domain** keeps the single CAD-subtracted volume containing the seed. Port buttons select entire cap surfaces.
5. CAD-verified straight circular/rectangular passages select laminar flow automatically. Other shapes support meshing only; general 3D flow is still unsupported. Acoustic analysis can instead apply pressure conditions on ports or walls.

Disable all ports for a sealed cavity. Solid/boundary seeds, leakage onto undeclared box faces and declared ports missing the selected volume are rejected. GUI caps remain axis-aligned box planes; the explicit API half-space extension is described below. Automatic opening-wire recognition, local/curved caps and general joining of fluid split across CAD volumes remain outstanding.

## Geometry and physics

OCC subtracts actual CAD solids, rather than substituting their bounding boxes. `gmsh.model.isInside` classifies the seed; CAD boundaries, volume and areas are inspected. Original STEP/tube geometry remains in the project. Port tags, seed, CAD volume and excluded-volume count are retained in the mesh.

Recognition checks two opposing end planes, CAD surface types and volume/area consistency. Round passages require cylindrical walls and circular caps; rectangular passages require axis-aligned planar walls and rectangular-prism volume. Analysis wall coordinates are checked too. The [fully developed laminar model](analysis-guide.md) solves scalar axial velocity, excluding entrance development, bends, separation, inertia and turbulence. Re ≤ 1500 and Mach ≤ 0.1 are enforced. Linear tetrahedra facet curved surfaces; CAD/mesh volume and flux retain discretization error.

Round reference: radius 8 mm, length 60 mm, Δp=0.01 Pa, μ=0.001 Pa·s. Analytic peak is 0.0026667 m/s and flow 2.6808e−7 m³/s. Target size 2 mm gives 0.0027200 m/s, 2.5737e−7 m³/s and 0.0191% end-flux imbalance. Refining to 1.5 mm reduces flux error. Rectangular STEP passages are also checked against a Fourier-series reference.

## Shared API

Use `sourceModel: {kind:'fluidDomain', mode:'internal', solid: originalCAD, enclosure:[x,y,z,dx,dy,dz], seedPoint:[x,y,z], portPlanes:[...]}` in mm. Planes 0/1/2 mean X/Y/Z minimum; 3/4/5 mean maximum. Built-in tube walls use `{kind:'tube', center:[x,y,z], axis:0|1|2, outerRadius, innerRadius, length}`, extending half the length each side of center.

`mesh.domainSelection` retains `ports`, `cadVolumeMm3` and recognized `channel`. Archive imports check ports/geometry against input. UI and API share the same mesh/solver.

Reference: [Gmsh official API — isInside / OCC / getBoundary](https://gmsh.info/doc/texinfo/). Boundary layers, arbitrary opening-wire caps, general volume joining/3D flow and conjugate heat transfer remain separate tasks.

## Explicit-configuration API route

Call window.fluidDomainApi.prepare with mode:internal and explicit box/seed/portPlanes, run mesh to success plus executionSettled, then applyMesh to display its surface. Existing domains may reuse their original solid. Unlike automatic channel switching in GUI examples, this API keeps study.kind:fluidDomain and clears properties/conditions/selection/provenance/intent. Channel summary metadata alone does not automatically enable flow solving. See the [operation contract](automation.md) for revision/mesh checks.

## Explicit API half-space caps (CFDPORT1 building)

Internal sources and prepareFluidDomain optionally accept 1–6 openingCaps entries `{id,point:[x,y,z],normal:[nx,ny,nz]}`. Points are inside the enclosure in mm; normals are explicit outward unit vectors. Retained fluid has dot(normal,x-point)<=0; the seed must be inward by more than 1e-6 mm. Normals are not inferred or rewritten. Specify portPlanes:[] when no box-face ports are used. This clips the entire enclosure with planes; it does not discover CAD opening wires or add a lid to only part of an opening.

Example: a Y-oriented tube with point=[0,-10,0], normal=-[1,2,3]/sqrt(14), and point=[0,10,0], normal=[1,2,3]/sqrt(14), is capped at x+2y+3z=+-20. Every cap must touch the seed-selected volume and undeclared box-face leakage is refused. capId/faceTag and surface.openingCapId are retained; restoration checks planes/half-spaces, every cap triangle's identity, complete/unique tetrahedral boundary and single connectivity. Capped meshes are not straight-channel certified. See [automation](automation.md) and [sanitized reference evidence](../evidence/2026-10-18-fluid-opening-caps.json). GUI input, published Worker, arbitrary wires and general volume joining remain unverified/incomplete.

## Formal-MCP bounded-cap loop

[Formal-MCP evidence](../evidence/2026-10-18-fluid-opening-caps-mcp.json) uses actual stdio/loopback,a Node-hosted semantic session and real CPU Worker:prepare,mesh,SHA-verified export,apply,revision-pinned full-input reconstruction and saved-file inspection. Oblique two-cap CAD relative-volume error1.042e-9,107/109 cap triangles,137721byte export. Seven refusals preserve input. Trusted-host mutation injection tests receiver validation;it does not expose MCP mesh mutation. This is separate from Chrome/deployed Worker verification;generic JSON import and physical flow solving are not demonstrated. Recorded dirty:true remains the historical runtime snapshot.

### Bounded-cap GUI loop

The internal-fluid panel accepts up to six explicit IDs/points/outward unit normals without inventing empty values. Invalid normals focus/mark the correction field. Bounds helpers preserve incomplete drafts;new models reset them. Project JSON saves only applied source and restores rows on reload. Failed meshing rolls back applied source while preserving draft rows. [Real-Chrome evidence](../evidence/2026-10-18-fluid-opening-caps-gui.json) verifies two caps,4021.239mm3,two ports,107 selected cap triangles,exact JSON roundtrip,JP/EN390px and keyboard. Nonintersecting-cap core diagnostics remain English;complete solver-diagnostic translation remains UIIMPROVE1 work. This does not validate deployed Workers,arbitrary wires,general joins or physical flow solving.
