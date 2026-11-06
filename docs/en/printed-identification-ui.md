# Read-only printed-material parameter identification

[日本語](../printed-identification-ui.md) · [Measurement JSON inspection](printed-measurement-ui.md) · [Identification audit and limits](printed-identification-audit-20261104.md)

Open the printed-material measurement inspector after material settings and enter JSON. Its existing validation, specimen selection, engineering curves and downloads remain available. The nested identification panel adds optional small-strain fitting without changing materials, projects, cases or solver input. It never applies fitted values or starts an analysis.

Select a model and enter every condition; fields start empty. Maximum engineering strain, minimum points and maximum relative standard error are always required. Bilinear fitting additionally requires a maximum tangent/elastic modulus ratio strictly between zero and one; SLS requires a relative held-strain tolerance. Missing or invalid values refuse execution. Moduli/stress use Pa; relaxation time uses s. Per-specimen refusals remain visible rather than implying a valid material.

Linear fitting passes through the origin. Bilinear fitting requires monotonic loading, positive tangent and no more than512 window points. SLS is a one-branch held-strain relaxation model requiring at least four hold points. Standard errors are conditional model approximations, not measurement accuracy. Synthetic and reported-measured sources are distinguished; both remain uncalibrated, accuracy-unverified and unapplied. Identification accuracy on real measurements is not verified here.

The unchanged parser and fitting API enforce2 MB,100 specimens and10000 total samples. Each request owns one module worker, terminated after10 seconds of worker processing or on edit, cancel, clear, destruction or BFcache invalidation. Results are bound to raw SHA-256, conditions and generation; invalidation immediately clears old results. Replies require at most100 dense specimens, model-specific three-parameter maximum, finite values, uncalibrated flags and256 KiB. Raw SHA preparation cannot be interrupted: its single preparation slot stays reserved until the actual digest settles, even after cancellation. No premature resource-release claim is made.

Ctrl/Command+Enter from a condition field runs identification. Language changes preserve input and conditions. No new download or material-application action is added. Actual browser acceptance remains a separate integration check.

[Implementation evidence](../evidence/2026-11-04-printed-identification-ui.json)


Both parent dataset inspection and identification reserve their own single SHA-preparation slot until actual settlement. Finite worker replies additionally must satisfy the selected model: tangent ratio, positive in-window yield/hold strain, yield stress = elastic modulus × yield strain, and R-squared ≤1. These consistency checks do not establish measurement accuracy.


The three explicitly labeled synthetic example buttons load invented curves and their visible toy conditions. They do not identify automatically. Loading replaces the JSON above, revokes its old validated downloads/results, and cancels old identification. Clear conditions leaves raw text untouched. These examples are not measured data or material recommendations; the legacy measurement example is unchanged. [Example formulas, truth and exact raw hashes](../evidence/2026-11-04-printed-identification-examples.json).


[Condition-specific summaries](printed-identification-groups.md) now replace the mixed overall average in this UI. Single-specimen scatter is explicitly unknown.
