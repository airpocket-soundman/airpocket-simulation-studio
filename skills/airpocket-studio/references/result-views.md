# Result Views

Repository-version reference. Discover actual connected tools before using names below; older registered servers may expose only a subset. Read only the sections needed for the task.

## Result views and saved cases

Prefer paired semantic MCP operations for implemented views/cases and the export jobs below for PNG/WebM. `getResultView` returns resultRevision, supported fields/display units and paged stored modes/times (limit <=50). `setResultView({expectedResultRevision,settings})` supports field/layers, nonnegative deformScale, camera position/target/up/fov, modeIndex, frameIndex or exact stored timeSeconds, and `{field,minimum,maximum}` colorRange (null = automatic). Use reported units: stress is displayed in MPa, temperature in degC. A different field resets automatic colors unless its new range is explicit. Capture/reapply state as JSON; case archives do not persist it automatically.

`probe` accepts optional expectedResultRevision and measures the displayed stored frame/mode, returning identity and assessment. Modes remain normalized shapes rather than dynamic response; deformation scale is visual only. Do not invent missing time frames or treat intermediate thermal retention as final-result playback.

`caseList` returns archiveRevision, compact IDs/revisions and metrics. Use `{caseId,expectedRevision}` for caseView/caseRestoreInput/caseRemove, add name for caseRename, or use `{name,expectedResultRevision}` for caseSave. Rename changes revision. External archive changes invalidate IDs; list again. Case display also restores saved input and therefore requires edit permission. Inspect scope can read, view scope changes settings, analyze scope saves and edit scope modifies/restores cases. Recheck state after a timeout before retrying any mutation. Chunked live case-archive transfers are described below. Bundling named views into case archives remains pending.

## PNG/WebM through the paired connector

Prefer `exportCapabilities` and semantic export jobs over browser code. Read capabilities first: WebM depends on browser recording support; MP4/GIF return false. With view scope, call `startExport({requestId,expectedResultRevision,format:"png"|"webm",animation:"orbit"|"deformation"|"time"|"slice",seconds})`; seconds is an integer 1..15 (default 5). Obtain expectedResultRevision from getResultView. The job freezes a copy of current view/settings and checks the result revision before rendering. Identical retained requests are idempotent; changed arguments need a new requestId.

Inspect scope permits exportCapabilities/exportStatus/exportArtifact. Poll `exportStatus({jobId})` to terminal state. Only completed jobs expose artifacts. Retrieve `exportArtifact({jobId,offset:0,length:65536})`, base64-decode data, follow nextOffset until null, concatenate bytes and verify totalBytes and SHA-256 against metadata (mimeType/name/sha256). Offset counts decoded bytes; length cannot exceed 65,536. No arbitrary browser scripts, arbitrary file paths or global filesystem access is needed. Jobs do not trigger downloads or persist output; save verified bytes only to a destination authorized by the user.

Use view scope for cancelExport/releaseExport; release retained output when finished. Default limits are 32 MiB total, four jobs and one active renderer including cancellation cleanup. Disconnect cancels connection-owned exports; late cancelled/released output is unavailable. Page exit loses output; case archives and restart recovery do not retain it.

WebM uses real-time recording targeting 24 fps, not deterministic fixed-frame output. Time playback uses stored transient-acoustic frames only; recording duration is not physical time. Deformation cycles change visualization scale, not the applied load or physical response. See docs/automation.md for the full contract.

Real-time recording requests 24 fps but does not guarantee frame counts; background tabs and load can drop frames. Deterministic fixed-frame export remains unimplemented.


## Portable named views

Use `namedViewList` (inspect) to read archiveRevision and viewId/revision/name/resultRevision. Read getResultView before saving. `namedViewSave({name,expectedResultRevision,expectedArchiveRevision})` (view) captures result settings/camera plus setup clipping/parts, field-defined units, ranges and selected frame/mode. Names are 1–100 characters, at most 16 views. No physical arrays or model are included.

`namedViewApply({viewId,expectedRevision,expectedResultRevision})` (view) requires the exact saved result revision, not another calculation's result. `namedViewRemove({viewId,expectedRevision})` requires view scope. Reinspect after conflicts/timeouts; do not reuse stale revisions blindly. Application failures attempt rollback.

`namedViewExport` (inspect) returns `{version:1,views:[{id,name,resultRevision,result,setup}]}`. Save JSON to a user-authorized destination, then use `namedViewImport({archive,expectedArchiveRevision})` (view) to transfer it back, replacing the entire current view list. Invalid schema, unknown keys, nonfinite values, bad cameras/ranges or duplicate IDs are rejected. There is no automatic localStorage persistence; use the case-view bundle below for combined transfer and export explicitly before page exit. Shared browser API: window.namedViewApi.list/save/apply/remove/export/import. The GUI panel offers equivalent save/restore/remove/import/export actions. Cross-result synchronization is unsupported.
