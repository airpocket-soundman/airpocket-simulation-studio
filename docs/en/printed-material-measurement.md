# Measuring printed materials and process conditions for CAE

[日本語](../printed-material-measurement.md)

Proposal date: 2026-10-14. Future project, not implemented equipment, specimen generation or parameter identification.

2026-10-28, work order 74 PRINTMEASURE2 first step: `src/printed-measurement-specimen.js` writes a core 3MF of a user-dimensioned dumbbell specimen with its planned orientation, layer height, walls and infill, and round-trips it through the existing 3MF importer. No standard dimensions are built in; Bambu Studio loading/slicing, reconciliation of user-chosen temperatures and UI/MCP are not done.

## Purpose and deliverables

Users print and measure specimens made with their own materials, printers and process settings to obtain corresponding CAE parameters. This project provides a reproducible measurement workflow rather than measuring and publishing universal material constants ourselves.

Provide a DIY-capable tension/compression machine design, an option to buy equipment from us, specimen data for each measurement, Bambu project generation, and application workflows for logs, evaluation, identification and CAE registration. DIY and sold devices share data/calibration contracts. Sales arrangements, design licensing, specifications and pricing remain undecided.

## What is measured

Separate baseline bulk-material specimens, high-fill printed references, process-dependent printed specimens and independent validation specimens. A high-fill print is not automatically a bulk-material measurement. Wall/infill response depends on geometry; identified effective parameters retain specimen, process, model and validity information. Do not double-count wall/infill stiffness when mixing equivalent and explicit models.

## Bambu projects and responsibilities

Prefer app-generated project 3MF containing geometry, placement/orientation and test-controlled settings, then let users inspect and slice in Bambu Studio. Pre-sliced universal G-code is not the default. Validate printer/nozzle/material-profile and version compatibility before advertising support.

We specify specimen dimensions, test identity/version, orientation, infill ratio/pattern, wall count/target thickness, layer height and top/bottom conditions. Users select filament, nozzle/bed temperatures, drying and relevant machine profiles. Record actual nozzle, line width, speed/cooling and other adopted settings; check compatibility with the test plan. Wall count does not uniquely establish actual thickness. Modified presets become measurements of the modified conditions.

Return adopted settings and necessary sliced information to the app for reconciliation. Record printed dimensions, mass and condition. Keep nozzle temperature separate from specimen temperature during testing.

## Equipment and identification

Design a frame, force/displacement sensing, drive, tensile grips and compression fixtures. Evaluate browser connectivity and file import. Device-side stopping and force/stroke limits remain functional independently of browser/LLM operation.

Provide force/displacement calibration, zeroing, time synchronization, compliance correction or direct gauge-length measurement; distinguish crosshead travel from specimen strain. Check slipping, platen alignment and specimen buckling.

Start with force/displacement, stress/strain, tensile/compressive stiffness and directional effective moduli, recording repeated-test variation and validity. Add strength/nonlinear parameters only within validated tests/models. Axial force/displacement alone cannot identify a complete orthotropic model: transverse strain is needed for Poisson ratios and appropriate measurements for shear constants. Separate measured, assumed and unidentified values. Fatigue, thermal/rate dependence and interlayer failure require additional test plans.

## Workflow and records

Select measurement goals, export versioned specimens/Bambu projects, let users configure and slice, reconcile adopted settings, record printed specimens, import calibrated raw test logs, identify models with fit/variation/missing-parameter reports, and validate on independent specimens before registering a user material profile.

Expose planning, export, reconciliation, import, fitting, validation and registration through MCP/API. LLMs support clarification and interpretation without inventing missing measurements. Equipment-operation permissions are separate from analysis actions.

Link specimen/version, Bambu version, geometry/settings hashes, printer/material/lot/settings, dimensions/mass, test temperature/rate, device/calibration, raw logs, processing/model versions, identified values and validation. User measurements are stored privately by default; sharing is a separate choice. Distinguish deliverable licensing from publication of measurement data.

## Stages and open decisions

Plan apparatus/specimens/procedures, implement Bambu project output and reconciliation, add logs and axial identification, then validate orientation/wall/infill models against independent tests. Equipment capacity/accuracy/sales, bulk-specimen preparation, test geometry/rates, condition matrix, supported Bambu versions/machines, transverse/shear tests and acceptance criteria remain undecided. Require traceable actual settings, reproducible calibrated identification, explicit unidentified parameters and independent validation.
