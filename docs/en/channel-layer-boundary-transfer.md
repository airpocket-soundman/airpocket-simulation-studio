# Limited parallel-plate Tet4 boundary transfer

[日本語](../channel-layer-boundary-transfer.md)

`src/channel-layer-boundary-transfer.js` provides a read-only face contract for limited orthogonal Tet4 geometry. Obtain the actual geometry SHA-256 using `getChannelLayerMeshRevision(mesh)` and pass it to `createChannelLayerBoundaryTransfer({mesh,expectedMeshRevision,conditions,maxTetEdgeAspectRatio,minimumTetVolumeMm3})`. Cached inspection is ignored. Stale geometry or changes during asynchronous hash verification are refused. `transferRevision` binds the mesh revision, conditions, quality limits and contract version.

All six conditions are explicit: lowerWall/upperWall no-slip-wall; xMin velocity-inlet with finite positive x velocity only (m/s); xMax finite pressure-outlet (Pa); zMin/zMax symmetry. Missing/extra fields, unsupported roles, reverse/oblique flow and nonfinite values are refused. Units are not converted implicitly.

Each boundary face retains a stable ID, node IDs, unique owning Tet ID, outward unit normal, centroid, area and wallId. Boundary groups retain their complete face ID sets, total area and condition. Normals are recomputed from oriented nodes and must match the box's outward axes. Node IDs refer to the original mesh bound by the returned mesh revision.

Downstream `validateChannelLayerBoundaryTransfer(input,transfer)` regenerates the complete manifest from exact inputs and compares its content. Modified normals, owners, areas, conditions, revisions and duplicate faces are refused rather than trusting a received manifest.

Each Tet reports volume, longest/shortest of all six edges and nearest-plate distance at its centroid. The entire transfer is refused if explicit volume/aspect limits fail. Node plate distance is `min(y,gap-y)` and is zero on the plates. This is distance to the two y planes, not a general wall-distance or y+ calculation.

The 10 mm gap, 2 mm length and 1 mm width reference yields 42 tetrahedra and 60 external faces. Plate areas are 2 mm² each, inlet/outlet 10 mm² each and z symmetry faces 20 mm² each. Minimum Tet centroid plate distance is 0.025 mm. The 0.1 mm cell edge ratio is `sqrt(2²+1²+0.1²)/0.1`. Tests independently check projected shoelace areas, owner-to-face outward signs, analytical diagonal ratios and plate distances.

The existing project/CAD boundary API requires original face selection/projection and is not connected automatically. Shared-edge nodal condition precedence is not inferred. Downstream solver connection, actual BC application, flow convergence, general 3D boundary layers and y+ remain unsupported. This contract transfers face identity and explicit intent only.
