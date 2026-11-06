# Read-only pages from saved SLS/Prony reports

[日本語](../printed-sls-report-artifacts.md) · [Saved CLI](printed-sls-prony-cli.md) · [Physical limits](printed-sls-prony-roundtrip.md)

`createPrintedSlsReportArtifact({rawReport,expectedSHA256,query})` creates native CSV/JSON/SVG from saved JSON. No refitting, Prony driver, original-dataset reread, solver or UI operation occurs. The caller-pinned SHA is content identity, not authenticity, physical correctness or verification against original datasets.

Explicit query fields: pairIndex0–7, role training/validation, format csv/json/svg, offset≥0, limit1–50. A response contains one pair, one role and one page, not a full curve. Total held rows, returned rows, unshown rows and nextOffset are explicit. The three series are observed, idealStep and PronyNominal, with nominal Pa stress, elapsed seconds from the hold and dimensionless engineering held strain. CSV/JSON also retain source times.

Raw input is at most4MiB, UTF-8 without BOM. The dedicated parser rejects decoded duplicate keys, depth above16, more than400000 values, arrays above4096, strings above4096 and nonfinite numbers. Gates check successful/refused schemas, versions, synthetic/uncalibrated flags, internal source-SHA bindings, row time/stress scales, saved-coefficient algebra and residual statistics. This is not a material reanalysis or measured-accuracy claim. Known pre-stdio-isolation schema1 execution records remain readable, without inventing an isolation proof.

Unidentified/timeout records return a reason and empty curves: no SVG polyline, metadata-only CSV refused row with no fabricated numerical samples, JSON rows:[]. XML text is escaped. Decoded C0 except TAB/LF/CR, FFFE/FFFF and lone surrogates reject at ingestion for all formats. Japanese and valid emoji pairs survive. String CSV cells are quoted; formula-like prefixes (=,+,-,@ after whitespace) receive an apostrophe. Actual negative numbers remain numeric. Legal XML TAB/LF/CR remain quoted in CSV.

Entire responses are at most64KiB UTF-8. A32KiB page budget reserves wrapper/file metadata room; long labels may reduce returned rows below50, explicitly marked by responseLimited and nextOffset. Native bytes/SHA, raw report bytes/SHA and page metadata accompany deterministic content. Native outputs preserve hypothetical finite-ramp, small-amplitude/time-grid and uncalibrated/accuracy-unverified warnings.

`readPrintedSlsReportArtifact({reportPath,expectedSHA256,query,outputPath?})` reuses common path/noLinks/regular-file gates. Its dedicated4MiB reader checks pre/post FD stat (dev/ino/size/mtime/ctime), path stat, limit+1 bytes and fatal UTF-8/BOM. The shared2MB helper is unchanged. Optional outputPath atomically publishes a new native CSV/JSON/SVG using a same-directory temporary file and exclusive hardlink, never overwriting an existing file. CSV/SVG are not quoted inside a JSON wrapper. This is atomic complete-byte visibility, not fsync/power-loss durability. Publication SHA matches native bytes.

No MCP/GUI/progress/shared-main change. [Evidence](../evidence/2026-11-07-printed-sls-report-artifacts.json)
