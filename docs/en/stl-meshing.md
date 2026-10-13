# Volume meshing of closed STL surfaces

[日本語](../stl-meshing.md)

Initial support is limited to one closed convex shell with outward-facing triangles, up to 2000 triangles. Coordinates are stored in mm after applying the unit selected during STL import. STL represents faceted geometry; it does not reconstruct the original CAD surface.

The geometry source is `{kind:'stl', positions:[x0,y0,z0,x1,y1,z1,x2,y2,z2,...]}`. `positions` is a finite-number array of triangle vertices in mm. Other keys are rejected. Save the display mesh and analysis source using the same normalized coordinates; do not apply the import scale again when restoring a project.

Validation matches nearby vertices within a scale-dependent tolerance and rejects holes, nonmanifold edges, duplicates, degenerate facets, inconsistent winding and multiple shells. Signed volume also rejects globally inward winding. Every vertex must lie in the inward half-space of every outward facet; concave geometry is rejected. Extremely thin or numerically unstable geometry is outside this initial scope. Geometry is never repaired automatically.

The convex restriction is not a general STL self-intersection detector. `selfIntersectionsChecked:false` means no general triangle-intersection check was performed; `convexBoundaryChecked:true` means the supporting half-space check passed. Use a supported geometry format such as STEP for cavities, multiple parts or concave shapes.

See the [official Gmsh t13 tutorial](https://gmsh.info/doc/texinfo/gmsh.html#t13) for the background on volume meshes from discrete surfaces. Solver-specific execution and element limits still apply. Agreement with a cube volume or uniaxial reference does not certify arbitrary geometry; use independent reference solutions and mesh comparisons.
