# Independent recalculation of actual main fixed WebM (2026-10-24)

[日本語](../fixed-webm-main-independent-2026-10-24.md)

A separate script rechecked the [fixed owner capture](../evidence/2026-10-24-fixed-comparison-webm/README.md), commit `e1aeed9456d3b167f84d19b3af96f0ad077bfff2`, runtime source8208329. See the [result JSON](../evidence/2026-10-24-fixed-comparison-webm/independent-crosscheck.json). This audit performed no browser operation, re-export, codec or solver execution.

All24 transport pages decoded into exactly1,540,510WebM bytes with SHA-256 `20fc86d0b17d1fa32f26f46575693b1a49a03ac350697f703a5fb0dea646d077`. The500,449-byte official normalized archive's raw SHA and canonical revision were rederived. Independent sorted JSON/SHA also matched each case revision and output-only resultRevision against caseList/manifest IDs. This does not claim reconstruction from pre-import bytes or an unavailable prepared snapshot.

BigInt rational rounding independently verified48 integer-microsecond presentation entries. Each requested physical time was matched to the nearest of24 stored times, checking all96panel indices and signed offsets. Both terminal panels selected frame23 at1.2ms with zero offset. Existing ffprobe raw matched all48PTS, VP8/key status,1280×640 and2.000000second overall duration including the final PTS-plus-duration. Existing48decoded SHA lines were all distinct; no new decode ran.

Five physical baselines—input, cases, comparison panel, result and view—were equal. The only retained-job difference was ownedExportJobs0→1. Release/disconnect proof remains in separate owner capture records.

Both panels share the same stored time axis, so heterogeneous-axis browser behavior is unverified. Forty-eight distinct image hashes do not imply48independently solved states: each source retains24snapshots and captions may change. Pure codec fixtures, the historical MediaRecorder partial and this actual-main capture remain separate. No publication, parent acceptance or progress change is claimed.

Replay read-only: `node docs/evidence/2026-10-24-fixed-comparison-webm/verify-independent.mjs docs/evidence/2026-10-24-fixed-comparison-webm`. It prints results; an optional second argument explicitly saves a new result path. No runtime/private/production helpers are imported.
