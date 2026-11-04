# Independent printed-identification UI audit (2026-11-04)

[日本語](../printed-identification-independent-audit.md)

Candidate `e8a2683e754f9e5d1cb43657975393fbcc5ab517` and fix `99dcf950258f6fea1b43c068da323ff9c3ef0292` were reviewed read-only. Six independent tests were added. All58 related UI, pure identification, existing measurement UI, layer and documentation tests pass; all37 contract declarations type-check. This audit commit adds no product-source fixes.

The initial candidate accepted a finite bilinear reply modified to `Et=2E, SE=RSE=0` despite its declared tangent ratio limit0.5. The fix checks tangent ratio, consistency of yield strain and stress, held-strain window and R² semantics. The independent suite refuses six model-semantic cases including that substitution.

The parent measurement inspector could also start a second import/digest after a raw edit and ABA restoration while its first SHA was unresolved. An independent test first reproduced two digest calls. After the fix, one preparation slot remains reserved until actual settlement. Child identification preparation independently survives raw/options ABA and disposal without reviving a Worker from a late digest. A stale Worker reply cannot replace a newer result, and a parent raw edit immediately revokes existing measurement URLs.

The independent numerical oracle is `x=.001*[1,2,3,4,5]`, `y=7e8*x+100*[-2,1,0,0,0] Pa`. Orthogonality of strain and noise gives through-origin E=7e8 Pa, SSE=50000 Pa², four residual degrees of freedom, standard error `100/sqrt(44e-6) Pa` and residual RMS100 Pa. These are derived without another identification implementation and checked through the real Node module Worker and mounted display. Conditional standard error remains distinct from measurement accuracy in Japanese and English; uncalibrated and unapplied labels remain visible. Forged RSE and across-specimen standard deviation are refused as well.

The [JSON record](../evidence/2026-11-04-printed-identification-independent-audit.json) retains fixed source hashes and results. Actual browser appearance and browser Worker cleanup, file CLI, material application, measurement calibration and publication are outside this record. No solver was run. Main, progress and the identification model implementation remain unchanged.
