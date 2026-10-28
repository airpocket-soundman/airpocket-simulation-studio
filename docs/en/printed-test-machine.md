# Requirements and machine profile for a printed-material tensile/compression tester

[日本語](../printed-test-machine.md)

2026-10-28, work order 73 PRINTMEASURE1, first step. Turns the "tensile and compression equipment" section of the [plan](printed-material-measurement.md) into requirements shared by DIY and sold machines and a data format describing a machine. Mechanical/electrical design, part selection, sales model and price are undecided; this document states no machine performance or accuracy.

## Requirements (DIY and sold machines)

| Item | Requirement | Undecided |
|---|---|---|
| Modes | Declare tension and/or compression; each mode has at least one fixture (grip/platen) | Fixture geometry, specimen mapping (PRINTMEASURE2) |
| Force sensing | Declare the load cell rated capacity; model is optional (null when absent) | Capacity, resolution, accuracy class |
| Displacement | Declare crosshead and gauge sources separately; engineering strain needs a gauge source | Extensometer/video method and accuracy |
| Stopping | Force, stroke and speed limits are enforced on the device (browser/host-only stops are rejected); force stop ≤ rated capacity | Stop response time and how to verify it |
| Compliance | Recorded as unmeasured or reported (mm/N with evidence); no crosshead correction is applied by this format | Measurement and correction procedure |
| Calibration | Force/displacement calibration recorded as unverified or reported (evidence strings); a report is not third-party verification | Procedure, pass criteria, interval |
| Identity | Machine ID, revision, hardware and software revisions, matching the dataset `instrument` | — |

## Machine profile format (schemaVersion 1)

`validatePrintedMachineProfile(object)` in `src/printed-test-machine-profile.js` validates and normalizes to N, mm and mm/s. Types: `src/contracts/printed-test-machine-profile.d.ts`. `origin` is diy/vendor; `provenance` is synthetic/declared. Declared means owner-stated; `accuracyVerified` is always false. Synthetic profiles cannot report calibration or compliance. Units are explicit strings; missing/extra fields, non-finite values, duplicate IDs, modes without fixtures, host-side stops and force stops above capacity are rejected.

`checkDatasetAgainstMachineProfile(profile, dataset)` compares a normalized [measurement dataset](printed-measurement-dataset.md) and returns findings instead of throwing: machine ID/hardware/software mismatch, dataset calibration reported while the profile is unverified, no gauge source, speed or force beyond device limits, force sign for a mode not offered. This check assumes positive force = tension and negative = compression (the dataset contract itself does not fix the sign). No findings does not mean the measurement is valid or accurate.

## Out of scope

Drawings, bill of materials, firmware, communication (direct browser/log import), GUI/MCP wiring, applying compliance correction, specimens and Bambu export (PRINTMEASURE2), identification (PRINTMEASURE3). All regression numbers are synthetic, not the capability of any real machine.
