# Single-view transient-acoustic fixed-time WebM

[日本語](../single-view-acoustic-fixed-webm.md)

Only single-view transient-acoustic time WebM saving and API/MCP `startExport` with `format:"webm", animation:"time"` use the fixed-frame path. Discover `singleTimeWebmExport`. Preview-only playback, orbit/deformation/slice WebM and thermal support retain their existing semantics; thermal time export remains PNG sequence only.

The source must be `acousticTransient` with2–2048 finite, nonnegative, strictly increasing saved times. Physical phase `i/(N-1)` spans its first through last time and selects the nearest saved frame, preferring the lower index on ties. No interpolation or solver is performed. Each output records requested time, actual saved time, signed `actual-requested` offset and saved index. Both source endpoints are selected exactly; visiting every source frame is not guaranteed.

Display duration is1–15 seconds and `N=min(seconds*24,120)`. Integer-microsecond presentation timestamps/durations total the display duration and remain distinct from physical time. The camera stays fixed. Caption-inclusive capture fits1280×640 and uses the existing32MiB cap. The existing comparison VP8 encoder/mux/decoder verifies every submitted/encoded timestamp, strict WebM structure and every decoded timestamp/dimension including the endpoint. Pending-output bound2,5-second stall/120-second total watchdogs, frame/codec cleanup and terminal callback guards are shared unchanged. Unsupported or incomplete verification fails with no realtime fallback.

Only encoder-issued Blobs receive a private WeakMap proof. Issuance uses a captured native Blob reader to bind exact original-byte SHA-256/length. Jobs reject overridden Blob readers, use the captured intrinsic, snapshot before SHA awaits and compare the proof identity. Payload changes are refused even when container structure/timestamps stay identical. The manifest retains saved result revision, byte SHA/length, resolution, full physical ledger and fixed-frame verification. Arbitrary Blobs and detached public diagnostic proof copies cannot issue that guarantee.

GUI stop, MCP cancellation/disconnect, displayed-result replacement and codec failures publish no partial artifact. Finally restores camera/controls/scale/clip and the original interpolated time state. If the displayed result changes, its new time is not overwritten with the old time. Existing `executionSettled` remains false until actual cleanup settles; cancelled state alone is insufficient.

[Automated evidence](../evidence/2026-10-24-single-view-acoustic-fixed-webm.json) uses synthetic codec/DOM doubles. It does not establish real browser output, GUI download, real-codec success or physical accuracy. Source results and parent acceptance status are unchanged.
