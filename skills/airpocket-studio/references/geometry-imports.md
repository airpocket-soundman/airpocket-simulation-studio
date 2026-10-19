# Geometry Imports

Repository-version reference. Discover actual connected tools before using names below; older registered servers may expose only a subset. Read only the sections needed for the task.

## Update STEP geometry

Inspect saved input with `studio_inspect_project({path})`; pass its revision to `studio_preview_cad_update({path,replacementPath,expectedRevision,offset?,limit?})`. Use distinct absolute input/replacement paths. Replacement accepts STEP/STP (50 MiB, embedded units normalized to mm) or a saved STEP project JSON. Preview changes nothing and returns compact matched/pending counts, `replacementRevision` and condition reports (offset >=0; limit 1–50, default 50), without full triangle arrays. Review pending regions, then call `studio_apply_cad_update({path,replacementPath,outputPath,expectedRevision,expectedReplacementRevision})` with both exact revisions and a distinct new output path; existing files are never overwritten.

Matching is conservative face geometry, not persistent CAD identity. Changed, split, missing or ambiguous regions remain unresolved and block analysis until reselection. Condition values remain, but old provenance becomes unconfirmed, assumptions are cleared and user confirmation removed. Reconfirm sources/applicability/values, reselect unresolved regions, preflight and recompute; do not treat a successful update as permission to run with unconfirmed inputs.

Live `previewCadUpdate` (inspect scope) and `applyCadUpdate` (edit scope) accept an inline imported STEP project as `replacement`, using the same input/replacement revision arguments. Shared API: window.cadUpdateApi.preview/apply. The connector command limit remains 500,000 JSON characters; no chunked live CAD transfer exists. For larger STEP files, use the saved-file tools above. Preview is read-only; applying changes invalidates old input/result references. See docs/automation.md for the full operation contract and remaining verification limits.

Live replacement JSON must carry canonical imported STEP display meshes with `kind:"cad"`; allowed mesh keys are `positions`, `faceIds`, `kind` and optional nonempty `sourceHash`. Every position must be exactly Float32-representable. Do not round coordinates or strip additional mesh metadata to bypass rejection. The saved-JSON MCP flow is unaffected; prefer actual STEP file paths for engineering updates.

## Print imports and layer inspection

Use `studio_import_print({path,outputPath})` for original `.3mf`/`.gcode` files up to 50,000,000 bytes. It saves the same `{version:1,filename,data}` as GUI export to a distinct new JSON file, with exclusive creation. Inspect that file with `studio_inspect_print({path,expectedRevision?,viewId?,kind?,offset?,limit?,layerIndex?})`; omit kind for the compact summary, or request segments/triangles pages (maximum 200 items). Preserve warnings and references.

For live sessions, use `printInspect` (inspect scope) to get the snapshot revision and `geometry`/`plate:N` view IDs. Unloaded revision is null. `importPrint({expectedRevision,format,filename,text?,base64?})` requires edit scope: use text for gcode, base64 for 3mf. Whole commands are limited to 500,000 JSON characters; use printTransfer import/write/commit below for large live inputs. Invalid, stale, busy or expired imports preserve old data. `getPrintData({expectedRevision,viewId?,kind,offset,limit,layerIndex?})` is inspect-only and bounded to 200 segments/triangles. `setPrintView({expectedRevision,settings:{viewId,allLayers,layerIndex}})` requires view scope and leaves the document revision unchanged. Layer indices are language independent. Shared browser methods are `window.printOperations.inspect/import/get/set/export`.

Do not infer strength or infill material properties from import. Coordinate frames are not automatically registered to the CAE model. These operations do not execute G-code or control devices; arc extrusion and unsupported commands follow existing parser rejection rules.

## Transfer large print data

For live original G-code/3MF bytes exceeding inline command capacity, use edit-scoped printTransferImport({expectedRevision,format,filename,totalBytes,sha256}), sequential printTransferWrite({transferId,offset,data}) with base64 chunks up to 65,536 decoded bytes, then printTransferCommit({transferId}). Original input is capped at 50,000,000 bytes. Commit verifies hash, byte count, G-code UTF-8 and current revision/busy/guard before existing atomic import. Keep the 500,000-character command limit.

For a full version 1 GUI snapshot, use inspect-scoped printTransferExport({expectedRevision}); read transferId/direction/totalBytes/sha256/maxChunkBytes/revision, then printTransferRead({transferId,offset,length}) in chunks <=65,536 bytes. Verify the joined-byte hash before decoding JSON. Export limit is 100,000,000 bytes. Release with printTransferRelease({transferId}) (inspect). Four transfers share 100,000,000 retained bytes, not a peak-heap guarantee. Disconnect frees session-owned transfers; page exit loses them. No printing commands are executed and no material strength is inferred.

Shared transfer API: window.printTransfer.beginExport/read/beginImport/write/commit/release. Immediate identical chunk replay is accepted. Completed/failed transfers retain slots until release. Local actual-browser transfer was checked; maximum-size capacity, peak heap and public HTTPS remain unverified.

Transfer size limits do not relax parser restrictions: G-code retains the 25,000,000-character/200,000-segment caps, and existing 3MF ZIP/triangle and other caps remain in force.

## Create live built-in geometry

Read inspect for the current input revision, then edit-scoped createBuiltinProject({expectedRevision,source,name?}) creates new mm inputs with the saved-tool shape contract: box(bounds), up to10 nonoverlapping boxes, fixed cylinder(radius12/length60 along Y), sphere(center/radius), tube(center/axis/radii/length). Conditions [] and materialProperties {} replace current inputs without inheriting old physical settings; current results are invalidated. Case/view/measurement/print histories remain separate. Candidate/revision computation precedes commit; busy, expiry/revocation or input changes refuse it. Configure physics/evidence and preflight before solving.

The shared browser entry is window.builtinProjectApi.create({expectedRevision,source,name?}); connected MCP uses the same adapter.

## Import STEP/STL into live inputs

Read inspect input revision, then use edit-scoped inputImportBegin({expectedRevision,format:"step"|"stl",name?,scaleToMm?,totalBytes,sha256}), sequential inputImportWrite({transferId,offset,data}) canonical base64 chunks <=65,536 decoded bytes, inputImportCommit({transferId}) and inputImportRelease({transferId}). Immediate identical chunk retry and repeated commit are idempotent. Shared inputImportApi.import accepts bytes ArrayBuffer/Uint8Array; inputImportTransfer handles staging.

Original input limit is50 MiB/file, with100,000,000 retained staging bytes/four slots, not peak heap or arbitrary STEP processing guarantees. STEP retains source bytes/mm normalization. STL needs explicit positive scaleToMm and a closed outward convex single shell <=2,000 triangles. New inputs do not inherit material/conditions, invalidate current results and leave case/view/measurement/print stores separate. Candidate normalization/new revision precede CAS; busy/input changes/expired guards/release/disconnect refuse late commit.

Import transfers are session-owned; other sessions cannot use them. Commands have a15-second deadline, not an arbitrary50 MiB STEP completion guarantee. Cancellation keeps the lock until CAD Worker termination handling completes; void terminate does not prove OS-thread exit.

## Prepare live fluid domains

Use edit-scoped prepareFluidDomain({expectedRevision,mode,enclosure,paddingMm?,seedPoint?,portPlanes?,openingCaps?,name?}) or window.fluidDomainApi.prepare. Exterior requires original STEP/built-in solid and box/sphere enclosure; internal accepts explicit [x,y,z,dx,dy,dz], seedPoint and portPlanes0..5 and may unwrap an existing domain. STL is unsupported. New inputs clear material/conditions/selection/provenance/intent and keep study fluidDomain.

Run mesh with the returned input revision, wait for succeeded plus executionSettled, then applyFluidDomainMesh({expectedRevision,jobId})/window.fluidDomainApi.applyMesh. Canonical input/revision/source fingerprint and mesh must match. A sourceHash-tagged gmsh surface updates display inputs without guessing physics; reread revision. domainSelection ports are bounded100/truncated with wall/channel summaries. Configure physical study/properties/conditions explicitly before solving; existing GUI demo automation is a separate path.

For internal-only half-space caps, optionally pass openingCaps:[{id,point,normal}] (1–6 entries, unique letter-first IDs up to64 letters/digits/_/-, points inside the box in mm, explicit unit outward normals within1e-8). Retain dot(normal,x-point)<=0; seed must be inward by more than1e-6 mm. Keep portPlanes explicit ([] if none). Never infer/reverse the normal from the seed or silently rewrite input. Each plane must cut the box and touch the selected fluid boundary; undeclared box-face leaks are refused.

This extension clips the whole enclosure before CAD subtraction and keeps one seed-connected volume. It does not recognize opening wires, make local partial-face lids, join general CAD volumes or certify capped channels for channelFlow. applyMesh summaries return {capId,faceTag} ports; saved cap surfaces carry openingCapId. Import/application checks plane/half-space/identity, complete tetrahedral boundary and connectivity. CFDPORT1 remains building. Operation names/counts are unchanged.

The internal-fluid panel also provides explicit cap rows: add/remove, ID, point in mm and all three outward unit-normal components. Enter all values; blanks are not zero and normals are not corrected automatically. Keep box-face ports explicit. Draft edits become project source only on domain extraction; reread the input revision after success, and inspect errors before retrying. Imported internal-domain source restores the cap rows. GUI controls are not an alternative semantic API: use the revision-guarded prepare/mesh/apply sequence above for agent operations.

Evidence scopes remain separate: `docs/evidence/2026-10-18-fluid-opening-caps.json` is the geometry/API reference; `docs/evidence/2026-10-18-fluid-opening-caps-mcp.json` is real stdio MCP through loopback Node-hosted semantics and a CPU Worker, including full artifact SHA, applied input reconstruction and seven refusals. The latter is not a real-Chrome or public-HTTPS test. Never infer general flow accuracy or arbitrary CAD support from these references.

`docs/evidence/2026-10-18-fluid-opening-caps-gui.json` separately records localhost Chrome extraction/port selection, applied-source JSON roundtrip, model reset, draft retention after bounds/failed extraction, Japanese/English switching, keyboard access and a 390px view. Unapplied draft rows are not saved project source. Core nonintersection diagnostics remain English; public HTTPS, arbitrary opening-wire detection and general volume joining are still unverified or unimplemented as stated above.

## Reuse saved coupling sources

Read inspect and caseList revisions, then edit-scoped applyCaseSource({expectedRevision,caseId,caseRevision,kind:"temperature"|"vibration",modeIndex?,amplitudeMm?,phaseDeg?})/window.caseSourceApi.apply. Temperature requires explicit structural/thermalStress:true and exact solid identity, including contact body IDs. Vibration requires acoustic/exteriorRadiation:true, no transient/sweep, exact saved box/current fluidDomain.solid, matching mode frequency, and explicit modeIndex/amplitudeMm/phaseDeg within existing bounds. Pressure boundary conflicts refuse application. Do not invent modal response amplitude or change physics to make a source fit.

clearCaseSource({expectedRevision,kind})/window.caseSourceApi.clear removes only that source, keeping other physics/settings/conditions. Input/case CAS and final host snapshot checks prevent stale application. Material evidence remains subject to ordinary snapshot checking, not automatic confirmation.

Source/ancestor /study provenance becomes unconfirmed, assumption:null and confirmation removed even for numerically identical replacement fields; other evidence/intent remain. Source caseReference:{schemaVersion:1,caseId,revision} preserves content-hash tracing, not persistent runtime-ID lookup after reload. Nonlegacy structural thermal stress with saved thermal fields has the evidence contract below. Modal-to-acoustic coupling retains its separate applicability limits; source application is not quantitative validation.

Multiple-box temperature sources also require nodeBodies, not just contact cases; legacy missing IDs are refused. Vibration application refuses manual impedance as well as pressure boundaries.

## Inspect surface defects

Use inspect-scoped live inspectSurface({meshIndex,toleranceMm?,problemOffset?,problemLimit?}) or studio_inspect_project({path,surfaceInspection:{meshIndex,toleranceMm?,problemOffset?,problemLimit?}}), reading report.surfaceInspection. meshIndex is explicit; pages default100/max200 over the full problem set, with problemTriangleCount/nextProblemOffset and problemTrianglesTruncated indicating more. Not limited to the legacy1,000 prefix. Use the returned project revision as edit expectedRevision for selectTriangles; indices are revision-scoped.

Boundary/nonmanifold/winding, degenerate/duplicate, component and signed-mm³ checks use display tessellation/tolerance, not exact CAD or self-intersection validation. closedEdgeTopology does not prove a single outward physical solid or volume-mesh success. No source mutation/automatic repair: fix original CAD/mesh and reload.

The flat report also includes full-project SHA-256 revision, meshIndex, units:{geometry:"mm",volume:"mm3"}, basis:"display-triangles", cadExactGeometryChecked:false, geometryModified:false and limitations. Shared function: inspectProjectSurface(project,options).

Aggregate signed-volume numerical overflow is refused, including finite-triangle cases; do not reinterpret range refusal as an ordinary open-surface null volume.

For page consistency, pin meshIndex and the first returned toleranceMm along with project revision; equal revisions alone do not guarantee equal problem sets when tolerance changes.

## Exact spherical sectors

Use semantic `selectSphericalRegion(meshIndex,spec)` in saved preview/edit or paired `edit`/`previewEdit`, then `addCondition`. Required spec: `{exactCad:true,center:[x,y,z],axis:[ax,ay,az],reference:[rx,ry,rz],radius,tolerance,latitudeMin,latitudeMax,startDegrees,sweepDegrees}`. Lengths/tolerance are mm; angles degrees. Latitude is equator-based, -90<=min<max<=90; sweep is 0<width<=360. Axis is normalized and reference orthogonalized; zero/parallel frames and overflow refuse. Tolerance affects display radius selection only, not CAD validation. Use explicit user-intended dimensions, never infer a load region from solver success.

One built-in sphere or STEP solid is supported, with analytic area R²Δλ(sinφmax−sinφmin), shared 20-region limit and existing curved faceting 3% maximum. Re-mesh using saved condition sphericalRegion; sphericalPatches/triangle labels are validated on case restore, with equivalent JSON key ordering accepted. Total force/heat power are conserved; per-area loads retain existing faceted integration. Wrong geometry/area/labels refuse. No new graphical selector, general UV, STL, fluid-domain or spherical thermal-contact support. `docs/evidence/2026-10-19-spherical-cad-region.json` separates CAD/Node Worker/stdio MCP verification from unverified deployed Worker and SolidCraft0.16 integration. Counts remain35 default/37 paired tools and 91 live operations; discover the actual server schema.

Localhost paired Chrome proof (inspect/edit scopes only): `docs/evidence/2026-10-19-preflight-gui-spherical-browser.json` records sphere selection418 triangles/exact157.07963267948963mm², 123N condition and descriptor retention. Bounded GUI JSON text→saved-file MCP reload preserves the exact input revision. This is not browser mesh/solve or a GUI file-import roundtrip; download/file-chooser waits timed out. No SolidCraft integration is established.
