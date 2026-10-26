# Fixed WebM decoded viewport validation

[日本語](../fixed-webm-decoded-viewport.md)

The first thermal WebM was refused at decoded-dimension verification and produced no successful artifact. Root's separate one-frame native diagnostic observed requested440×637, coded440×638, exact visible/display440×637, origin0, rotation0 and flipfalse. [WebCodecs](https://www.w3.org/TR/2026/WD-webcodecs-20261019/#videoframe-interface) permits coded dimensions to contain invisible padding, so visible pixels and backing storage are verified separately.

The shared decoder requires an integer visible rectangle at origin0, exact requested width/height, and containment within coded dimensions. Display dimensions must match exactly, with rotation0/flipfalse. Positive integer coded dimensions must fit the explicit product storage profile: requested through requested+16 pixels on each axis. The 16px cap is not a universal codec guarantee. Submitted PTS membership, duplicates, endpoints, flush and private byte-SHA requirements are unchanged. Capture is not rounded to even dimensions; arbitrary cropping/aspect transforms are not accepted.

Twenty fake regressions cover observed odd padding, the +16 boundary, wrong visible/display sizes, fractions, out-of-range values, +17 padding, transforms and wrong PTS. Existing codec doubles now provide realistic viewport metadata. Related fake tests:183 passed, zero failures/skips;25 type declarations. An initial broader200-test batch recorded198 passes and2 failures: missing prebuilt WASM prevented a real solve from starting, and an obsolete blanket thermal-refusal assertion. The latter now checks explicit temperature-field refusal. No WASM was fetched or real solve retried; root will verify that file in its existing build environment.

See [raw diagnostic bytes/hashes and results](../evidence/2026-10-26-decoded-viewport/summary.json). A successful real thermal export after this fix remains unverified; no automatic export retry occurred. Additional owner real-codec/GUI/solver/product-export runs:zero.
