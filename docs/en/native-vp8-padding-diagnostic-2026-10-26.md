# Isolated VP8 dimension diagnostic (2026-10-26)

[日本語](../native-vp8-padding-diagnostic-2026-10-26.md)

This preserves root's one-frame native VideoEncoder/VideoDecoder diagnostic, separate from application exports: [summary](../evidence/2026-10-26-native-vp8-padding-diagnostic.json), [raw observation](../evidence/2026-10-26-native-vp8-padding-diagnostic/native.json) and [screenshot](../evidence/2026-10-26-native-vp8-padding-diagnostic/native.jpg). The HTML is archived source and was not opened/reexecuted during packaging. Three raw files were byte-copied with SHA256 and Git blob SHA1 checks.

Requested/input dimensions were440×637, including input coded/display/visible rectangle. After one encode and one decode, the decoded frame reported coded440×638, display440×637, visible rectangle x0/y0/440×637, rotation0, flip false and timestamp0. The reported UA is Chrome156-family, not verified full-version or another-engine coverage. Product exports were zero. This is not full-pixel accuracy or arbitrary-codec verification.

The isolated result observes coded-height padding while preserving visible/display dimensions. It does not directly record the exact native properties of the original [failed200 product frame](../evidence/2026-10-26-thermal-time-webm-failed/README.md), and alone does not establish its root cause. Historical failure/settlement, absent artifact, exhausted budget and selected GUI restoration/cleanup evidence remain unchanged.

The original driver's SHA256 `1d458e83c8e11af96fc3ac52d69d6970f50168a330fdbcce273813fc64dc1e88` was rechecked unchanged. Packaging performed zero additional application exports, solver, codec or GUI runs. No future product success or new execution budget is implied.
