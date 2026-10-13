# Exterior fluid domains

[日本語](../fluid-domains.md)

Load STEP or a built-in solid, set solid-to-enclosure padding, then create the surrounding fluid domain. Gmsh/OpenCASCADE Boolean subtraction removes the solid volume from an enclosure box; Tet4 elements mesh the remainder. This creates a real computational domain rather than a display-only box.

Retain the original solid in sourceModel.solid and enclosure bounds in sourceModel.enclosure, in mm. Before meshing, verify that the enclosure contains the exact CAD bounds with a positive gap. If display triangles underestimate exact CAD bounds, increase the padding. Remove disconnected fluid volumes in sealed cavities from the exterior domain.

The example subtracts a 10 mm cube from a 30 mm cube: 26,000 mm³ and 949 elements. A Z=5 mm section with flipped side exposes the original solid space; its 100 mm² inner face is selectable. Clipping creates no new cap faces.

Exterior domains support meshing/project roundtrips; spherical domains also support [exterior acoustics](exterior-acoustics.md) and [one-way vibration acoustics](vibration-acoustics.md). General 3D flow solving is not connected. Incorrect structural solving is rejected. Arbitrarily oriented caps, general inlet/outlet conditions, boundary-layer meshing, turbulence and conjugate heat transfer remain outstanding. Fully developed laminar round/rectangular channels are a separate limited mode.

Browser API: `await analysisApi.createExteriorDomain(paddingMm)` and `await analysisApi.loadExteriorExample()`. Node: `exteriorFluidSource(project,paddingMm)` builds input and `generateMesh(initialize,source,{size})` produces the actual mesh. Automated tests cover simple/multiple solids, sealed STEP cavities and source/project persistence.

Spherical exterior air domains also support [radiation acoustics](exterior-acoustics.md). General 3D flow remains unsupported.

[Internal CAD extraction and cap ports](internal-fluid.md) uses X/Y/Z box planes and a seed-selected CAD volume. General 3D flow and arbitrarily oriented caps remain unsupported.
