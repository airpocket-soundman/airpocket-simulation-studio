# Exterior fluid domains

[日本語](../fluid-domains.md)

Load STEP or a built-in solid, set solid-to-enclosure padding, then create the surrounding fluid domain. Gmsh/OpenCASCADE Boolean subtraction removes the solid volume from an enclosure box; Tet4 elements mesh the remainder. This creates a real computational domain rather than a display-only box.

Retain the original solid in sourceModel.solid and enclosure bounds in sourceModel.enclosure, in mm. Before meshing, verify that the enclosure contains the exact CAD bounds with a positive gap. If display triangles underestimate exact CAD bounds, increase the padding. Remove disconnected fluid volumes in sealed cavities from the exterior domain.

The example subtracts a 10 mm cube from a 30 mm cube: 26,000 mm³ and 949 elements. A Z=5 mm section with flipped side exposes the original solid space; its 100 mm² inner face is selectable. Clipping creates no new cap faces.

Exterior domains support meshing/project roundtrips; spherical domains also support [exterior acoustics](exterior-acoustics.md) and [one-way vibration acoustics](vibration-acoustics.md). General 3D flow solving is not connected. Incorrect structural solving is rejected. Arbitrarily oriented caps, general inlet/outlet conditions, boundary-layer meshing, turbulence and conjugate heat transfer remain outstanding. Fully developed laminar round/rectangular channels are a separate limited mode.

Browser API: `await analysisApi.createExteriorDomain(paddingMm)` and `await analysisApi.loadExteriorExample()`. Node: `exteriorFluidSource(project,paddingMm)` builds input and `generateMesh(initialize,source,{size})` produces the actual mesh. Automated tests cover simple/multiple solids, sealed STEP cavities and source/project persistence.

Spherical exterior air domains also support [radiation acoustics](exterior-acoustics.md). General 3D flow remains unsupported.

[Internal CAD extraction and cap ports](internal-fluid.md) uses X/Y/Z box planes and a seed-selected CAD volume. General 3D flow and arbitrarily oriented caps remain unsupported.

## Revision-bound shared API/MCP

Use shared window.fluidDomainApi.prepare/connected prepareFluidDomain, run startJob mesh, then after success plus executionSettled apply the surface through applyMesh/applyFluidDomainMesh. New inputs clear properties/conditions/selection/provenance/intent and retain fluidDomain study. Unlike existing all-in-one GUI examples, configure fluid/acoustic properties and conditions explicitly. See the [operation contract](automation.md).

## Explicit opening-candidate confirmation (CFDPORT1)

`confirmOpeningCandidate` in `src/opening-candidate-cap.js` is a pure adapter accepting the current indexed triangle mesh, integer `meshVersion`, a complete detected candidate and a confirmation carrying the same version. The caller must advance the version whenever the mesh changes. It requires `confirmed: true`, a cap ID, an explicitly supplied unit `outwardNormal`, an `interiorPointMm`, and an `enclosure` box in mm. Re-extracting and comparing every candidate field rejects stale versions, tampering, unhealthy components and unresolved seams. The normal must align with the candidate plane; the interior point must lie inside the enclosure and strictly on the retained side under the existing cap contract. Canonical candidate winding never determines physical outward direction.

The returned `source.openingCaps` uses the existing half-space cap contract. Original `nodeIndices`, `toleranceMm` and `meshVersion` are retained, with no input mutation or array aliasing. Reversing the normal changes the retained side and requires a corresponding interior point. Confirmation does not establish a closed shell, create a local CAD lid or generate a fluid mesh. UI/API integration, arbitrary wires and multiple volumes are outside this adapter's scope.

### 2026-10-23: missing provider for manual-form integration

Read-only review at `842fe553284a62383d9ed0a9b5f374f263d667bc` distinguishes the verified pure confirmation above from an unimplemented candidate-to-form workflow.

- Detection requires an indexed triangle surface with shared node identities and incidence-one boundary edges; coincident IDs are not welded ([input](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/842fe553284a62383d9ed0a9b5f374f263d667bc/src/opening-loop-candidates.js#L7), [edge/seam rule](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/842fe553284a62383d9ed0a9b5f374f263d667bc/src/opening-loop-candidates.js#L28)). The full boundary of a closed Tet4 volume is different. Capped results [require a complete Tet4 boundary](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/842fe553284a62383d9ed0a9b5f374f263d667bc/src/fluid-opening-caps.js#L47), not an open-surface source.
- Display positions/faceIds are [flattened per-triangle surface data](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/842fe553284a62383d9ed0a9b5f374f263d667bc/src/fluid-domain-operations.js#L76), without the original shared indexing. Giving each triangle new IDs fabricates seams; coordinate welding does not preserve original identities. Do not reinterpret that display as an open CAD surface.
- mesh.sourceHash [checks the sourceModel fingerprint](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/842fe553284a62383d9ed0a9b5f374f263d667bc/src/fluid-domain-operations.js#L75), not remeshed node/triangle identity. Confirmation [requires caller-owned monotonic meshVersion](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/842fe553284a62383d9ed0a9b5f374f263d667bc/src/opening-candidate-cap.js#L10); project and result/case-selection generations are distinct.
- main [mounts the manual component](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/842fe553284a62383d9ed0a9b5f374f263d667bc/src/main.js#L107), whose boundary is [read/restore only](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/842fe553284a62383d9ed0a9b5f374f263d667bc/src/ui/internal-opening-caps-ui.js#L42). No indexed opening-source/version provider is injected. Restore replaces all rows and must not silently replace unsaved drafts.

A future provider must explicitly supply an open indexed surface, immutable nodes/triangles,tolerance,monotonic version and content/source identities. A selected patch edge or removal of existing port faces is not automatically a new CAD opening. The UI needs explicit outward-normal and current seed/enclosure confirmation, re-extraction, combined cap validation and a final generation/geometry check before atomic append. Never infer the normal sign or treat empty controls converted to0 by the [current geometry reader](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/842fe553284a62383d9ed0a9b5f374f263d667bc/src/ui/study-form-ui.js#L12) as explicit input. No connection is added without that provider; manual caps and the limited confirmation acceptance remain unchanged.
