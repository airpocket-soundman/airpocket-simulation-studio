# Limited parallel-plate Tet4 conversion (CFDMESH1)

[日本語](../channel-layer-tet4.md)

`src/channel-layer-tet4.js` accepts the same input as `createChannelLayerCellQuality` and converts each accepted orthogonal cell into six Tet4 elements in a pure operation. Length, volume and area units are mm, mm³ and mm². Inputs remain unchanged.

Every cell uses the same axis-ordered Freudenthal subdivision and shares the four nodes on each y coordinate plane. Inspection requires positive finite signed element volumes, exactly two oppositely oriented incidences for each internal face, and boundary faces on the six box planes. Duplicate elements, duplicate positions, open internal faces and nonconforming faces are refused. Relative errors in total volume and all six boundary areas must not exceed 1e-12. Existing height and aspect thresholds are retained.

`inspectChannelLayerTet4` rechecks the geometry without mutation and reports boundary triangles with `lowerWall` / `upperWall` tags and wallId 0 / 1. The other four planes have null wallId. The reference gap 10, length 2, width 1 and wall heights 0.1, 0.2, 0.4 mm produce seven cells, 32 nodes, 42 tetrahedra, 54 internal faces, 60 external faces, volume 20 mm³ and wall area 2 mm² on each wall.

This is limited geometric inspection. General Gmsh boundary layers, solver/UI connections, flow solutions, solver wall-tag transfer, y+ and general physical accuracy remain unsupported.

Validation: `node --test tests/channel-layer-tet4.test.mjs tests/channel-layer-cell-quality.test.mjs tests/mesh-validity.test.mjs`. Tests independently calculate signed volume and wall area.
