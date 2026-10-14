# Case Archives Measurements

Repository-version reference. Discover actual connected tools before using names below; older registered servers may expose only a subset. Read only the sections needed for the task.

## Transfer complete live case archives

Use caseArchiveExport({}) (inspect), then caseArchiveRead({transferId,offset,length}) to fetch base64 data/nextOffset. nextOffset:null marks the end. The export descriptor includes archiveRevision, totalBytes, sha256 and maxChunkBytes. Assemble all bytes and verify SHA-256 before saving to an authorized destination. Existing version 1 JSON includes complete physical results without truncation; named views remain separate.

For import, read caseList's archiveRevision, encode JSON as UTF-8 and compute totalBytes/sha256 (`sha256:` plus 64 lowercase hexadecimal digits; revisions use the same format). Use caseArchiveImport({expectedArchiveRevision,totalBytes,sha256}) (edit), sequential caseArchiveWrite({transferId,offset,data}) (edit) with at most 65,536 decoded bytes per base64 chunk, then caseArchiveCommit({transferId}) (edit). Commit validates completeness/hash/UTF-8/JSON/cases and archive revision before atomic replacement (eight-case limit). Import invalidates runtime case IDs; list again. Do not retry a timed-out commit blindly: inspect the current archive revision first.

Shared API: window.caseArchiveTransfer.beginExport/read/beginImport/write/commit/release. Shared retention limits are 100,000,000 bytes and four transfers. Invalid, incomplete, stale, expired or hash-mismatched imports preserve cases. Release staging/output via caseArchiveRelease({transferId}) (inspect), including after failures. Disconnect drops connection-owned imports; page exit loses unsaved transfers. No filesystem or arbitrary browser-code operation is exposed.

Archive staging limits bound retained buffers, not peak browser heap. Release completed imports too: their bytes remain retained to make commit retries idempotent.

## Case-view bundles

Use read-only studio_validate_case_bundle({path}) for v1 `{version:1,kind:"case-view-bundle",caseArchive:{version:1,cases},namedViewArchive:{version:1,views}}` or production v2 `{version:2,kind:"case-view-bundle",caseArchive,namedViewArchive,measurementArchive}`. Child archives use existing version 1 schemas. Each named-view resultRevision must equal the JSON-normalized display-prepared output hash from prepareCaseView(saved), matching createResultViewApi. Legacy mesh.summary recomputation can make raw saved-output hashes differ: do not remap supplied views or mutate the physical archive; display the case and resave a view that refers only to the raw hash. Then save its associated case or remove the orphan view before export. Do not silently discard it or remap to another result. Fields/modes/frames and setup mesh counts are validated.

Live caseBundleList (inspect) returns archiveRevision and case/view/measurement counts. Use caseBundleExport/Read/Release (inspect) and caseBundleImport/Write/Commit (edit) with the same arguments as caseArchive transfers. Four bundle transfer slots share 100,000,000 retained bytes, not a peak-heap bound. Hash/CAS/snapshot checks precede atomic synchronous replacement of all three stores for v2; no current-input change or automatic view application occurs. Named-view IDs survive but runtime case IDs may change: relist cases. Existing separate formats remain valid; dedicated GUI controls also handle bundles.

Shared bundle APIs are window.caseBundleApi.list/exportArchive/importArchive and window.caseBundleTransfer.beginExport/read/beginImport/write/commit/release.

Local actual-browser bundle export/import and case/view restoration were verified with real WASM/MCP. Public HTTPS, maximum capacity and all-result-kind GUI coverage remain unverified.

## Measurement history

Use measurementList/Get/Export (inspect scope) and measurementSave/Remove/Import (edit scope) to retain point samples with fixed resultRevision, point, options, current display/time/mode, measurements and assessment. Shared window.measurementApi methods are list/get/save/remove/exportArchive/importArchive. Options accept bodyIndex/elementIndex only: select the intended saved frame/mode through resultView first, then save its displayed sample. Never substitute modeIndex/frameIndex options.

History is capped at 100 entries and 300,000 UTF-8 bytes of strict archive JSON; full result bodies are absent. Export explicitly to preserve it. Imported values are historical records with schema validation, not independently verified numerical results. A history GUI is not included.

Read getResultView and measurementList first, then call `measurementSave({name:"Tip displacement",expectedResultRevision,expectedArchiveRevision,point:[5,5,40],options:{}})` with the actual returned revisions. `measurementGet({measurementId,expectedRevision?})` retrieves the fixed evidence; `measurementRemove({measurementId,expectedRevision,expectedArchiveRevision?})` removes it. Recorded entries report recordedEvidence:true and independentlyVerified:false.

measurementExport returns `{archiveRevision,archive:{version:1,measurements:[{id,name,resultRevision,point,options,evidence}]}}`; persist archive explicitly and restore with measurementImport({archive,expectedArchiveRevision}). Import replaces the whole list, preserves IDs and rejects duplicates. No timestamp is recorded; host guard callbacks are not JSON arguments.

## Check history against saved fields

Use `studio_verify_measurements({casesPath,measurementsPath})` to strictly validate both archives and recompute each sample through resultView.probe from matching display-prepared case output, retaining recorded field/time/mode/point/options. Orphan results or any canonical evidence mismatch refuse verification. Connected `measurementVerify({expectedArchiveRevision,expectedCaseArchiveRevision})` uses current history and raw-case-archive SHA; shared method is window.measurementApi.verify.

Successful verification reports verified:true, verification:"recomputed-from-saved-results", physicalAccuracyVerified:false and compact matches with measurementId/resultRevision/caseIndexes. This proves agreement with saved fields only; it is not independent numerical or physical validation and does not alter historical independentlyVerified:false flags.

Before live verification, read caseList and measurementList. Call `measurementVerify({expectedCaseArchiveRevision:cases.archiveRevision,expectedArchiveRevision:history.archiveRevision})` using those responses; no transfer is required. Returned archiveRevision/caseArchiveRevision identify the checked snapshots.

v2 bundles recompute every recorded measurement against the matching display-prepared case result and require full evidence equality; refuse orphan/tampered records rather than dropping them. The same seven bundle methods/100 MB transfer and GUI controls handle v2. Importing old v1 explicitly clears measurement history; export needed history first. Import does not apply current inputs/results or promote history flags to independent numerical verification.

On a measurement-enabled host, v1 import returns measurementsCleared:true and an effective v2 revision with empty history. v2 metadata includes measurementCount. Local actual-UI v1 clearing/v2 restoration and GUI/MCP export-byte equality were checked.

caseBundleExport() is read-only: it returns the captured snapshot revision, without an expectedArchiveRevision precondition. Keep expectedArchiveRevision mandatory for import/CAS.
