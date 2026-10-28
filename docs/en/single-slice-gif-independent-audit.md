# Independent thermal section GIF audit (2026-10-27)

[日本語](../single-slice-gif-independent-audit.md)

Candidate `ddf0922ec7b913446e06e68a700fec5d3ce808fc` was reviewed without implementation changes. No mandatory fix was found. This record verifies the contract for scanning section positions at one fixed saved/interpolated temperature time; it is not actual browser export or visible-model acceptance for209.

- A translated anisotropic Tet4 has X extent−2..4 mm. Its X=1 mm section vertices are `(1,1,3), (1,1,7), (1,3,3)`, giving4 mm². The independent affine temperature `100+2x−3y+0.5z+3t` at interpolated time4 s integrates to `1334/3 degC·mm²`. The24 positions, retained-side reversal and fixed time are checked separately. This is a displayed-value oracle, not heat rate or a new analysis.
- Snapshots from the real `createViewApi` reject substitutions of axis, position, side, opacity, hidden parts, clipping enablement and time. Later caller mutations cannot modify the issued proof. Setup and surface-connectivity getters are refused without invocation.
- A job→preparation→renderer test pauses owned work after the seventh capture. Cancellation, watchdog expiry and a same-result retained-side edit keep the renderer lease, disabled controls and unsettled execution until that actual work completes, without publishing an artifact. The full setup, hidden-part visibility and original interpolated time are then restored through the real settings API.

The real main input uses `type=number, step=any`, so range-input quantization is not assumed. The restoration target `createViewApi.set` has no renderer-busy refusal. The test uses its actual get/set/oninput pattern rather than a direct assignment masquerading as restoration.

Results and fixed source hashes are in the [JSON record](../evidence/single-slice-gif-independent-audit-20261027.json). An initial launch occurred before dependency installation completed and failed to resolve Three. It is distinguished from validation after dependencies were ready. No existing assertions were weakened.

No actual GUI, product GIF export, external pixel decode or solver was run. The existing possibility of empty boundary sections remains explicit. Existing207/208 source and evidence, progress and parent task statuses remain unchanged.
