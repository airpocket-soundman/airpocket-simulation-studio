# Independent saved-file identification CLI audit (2026-11-04)

[日本語](../printed-identification-file-independent-audit.md)

Fixed CLI `449e3d2ec8a8dd3c72a5476284e83f52501fd3ad` and refusal-diagnostic fix `6ba5983741b9b10c45d566a41f4188f9edd6741f` were audited. No additional mandatory CLI fix was found. All44 related tests, including four independent groups, pass; all37 declarations type-check. This is read-only identification from saved synthetic JSON. This audit commit adds no product-source changes.

The independent oracle uses the same noise orthogonal to strain as the [UI audit](printed-identification-independent-audit.md). Actual CLI output from input converted to m/kN, retaining Japanese UTF-8 text and whitespace, matches E=7e8 Pa, SE=`100/sqrt(44e-6) Pa` and RMS=100 Pa. Full raw/options bytes, SHA-256, lengths and input immutability are checked. Full artifact hash and trailing newline are checked too.

When only one specimen fails the declared uncertainty condition, overall exit2/status refused remains. That specimen retains its original reason and finite RSE without invented coefficients; the resolved specimen remains an individual result, without fabricating across-specimen statistics from one success. The core finite-refusal fix is also exercised through the real CLI: unresolved extreme-small-strain uncertainty and subnormal-time SLS keep their original reasons while omitting undefined optional numeric diagnostics.

Three concurrent processes publishing a refused result to one new path produce one exit2 winner and two exit1/OUTPUT_EXISTS losers. Published bytes/hash match the winner; another invocation cannot replace the artifact or inputs. No temporary files remain. Test cleanup verifies its dedicated directory prefix and absolute parent before recursive removal.

Source review checks the bounded limit+1 FD buffer, bigint file identity before/after reading, UTF-8/BOM refusal, decoded duplicate-key detection in options JSON, refusal of existing files/link aliases/symlink ancestors and reuse of exclusive hardlink publication. The [JSON record](../evidence/2026-11-04-printed-identification-file-independent-audit.json) retains fixed source hashes and executed scope.

This is not exhaustive proof over every operating-system schedule for concurrent file or ancestor changes. No browser, measurement calibration, material application, solver or new public/MCP operation was validated. Independent material-accuracy validation and the PRINTMEASURE3 parent remain incomplete.
