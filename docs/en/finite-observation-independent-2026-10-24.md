# Independent final synthetic observation audit

[日本語](../finite-observation-independent-2026-10-24.md)

Owner commit `1eef75a6dae30ba7f20c7f806602f6dbf7024d6f` is fixed. A two-step hydrostatic Green-strain ramp/hold complements the owner's shear oracle. For `E=eI`, `dev(E)=0`, the Maxwell internal variable and dissipation remain zero, `S=3KeI`, and reference-volume energy is `K(3e)^2/2`. The independent oracle imports no production model or replay helper.

Three new regressions cover this nonzero bulk response; asymmetric signed component errors and separate energy/dissipation; distinct raw formatting with equal independently sorted canonical identity; and ownership of two offset views sharing a caller ArrayBuffer before awaits, without invoking history getters. Together with six owner regressions, nine passed with zero failures or skips. The initial fixture used K/mu=3.75 and was correctly rejected by the documented envelope; mu was corrected to 1e6 (ratio3). No product code or tolerance was changed.

Source review also checked raw/canonical/parameter hashes, exact time, fixed units/provenance, unknown/measured/calibrated refusal, retained failure stepIndex and absence of comparison on failed history. The [evidence JSON](../evidence/2026-10-24-finite-observation-independent.json) records source hashes and scope. This remains synthetic, provisional and uncalibrated, with no fitting, tolerance acceptance, measured data, structural reactions or plasticity. Additional solver/GUI/codec runs and progress changes: zero.

Replay: `node --test tests/finite-visco-observation-independent.test.mjs tests/finite-visco-observation-comparison.test.mjs`.
