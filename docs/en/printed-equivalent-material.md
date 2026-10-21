# Printed equivalent orthotropic material

[日本語](../printed-equivalent-material.md)

2026-10-21. This bounded PRINT2 increment binds `materialProperties.printedEquivalent` metadata to existing `orthotropic` constants. It performs no calibration, physical measurement or detailed layer/wall/infill analysis. PRINT2 remains building.

The version1 record has model `equivalent-orthotropic`,id,units,specimen,material,printer,print,constants,basis,validity. `tests/fixtures/printed-equivalent-material.mjs` is a complete synthetic example, not a real printer, physical specimen or measurement.

- Explicit units: length=mm,modulus=Pa,direction=1,temperature=degC,strainRate=1/s,fraction=1. Missing or different units are refused, not converted.
- Specimen: id and three dimensions in mm. Material: name/batch. Printer: model. Print: unit buildDirection,layerHeightMm,wallCount,wallThicknessMm,infillFraction,infillPattern. Unknown wall thickness stays explicit null; wall count never supplies an inferred thickness.
- Constants: youngModuliPa,poissonRatios,shearModuliPa,axes must exactly match registered orthotropic data. Existing right-handed orthonormal frame and positive-definite compliance checks apply. Stale constants/axes refuse the record.
- Basis kind: theoretical,assumed,identified. Source,identification and independentValidation are explicit. Theory/assumption uses null identification. Identified datasets contain id,revision,specimenIds including the calibration specimen. Independent validation requires different dataset IDs and disjoint specimens; revision labels are local to each dataset, so equal labels such as v1 are allowed. These are consistency checks of declared references, not authentication of measured data.
- Validity: temperatureRangeC,strainRateRangePerSecond,layerHeightRangeMm,infillFractionRange. Print settings must remain inside the declared ranges. Static zero strain rate and explicit study.materialTemperature are checked before execution. Modes/thermal stress are unsupported for this record.

The normal material/project save-load validator checks the record; preflight emits PRINTED_EQUIVALENT_INVALID for refusals. Actual Worker material resolution checks temperature/rate bounds again. Legacy orthotropic inputs without this record retain existing behavior.

`materialProperties.printedStructure` reserves an explicit wall/infill refusal boundary. No explicit structural solver exists, so it is refused alone and together with printedEquivalent. No double addition of equivalent and explicit stiffness is introduced. Existing 3MF/G-code import/display is unchanged.

[Verification evidence](../evidence/2026-10-21-printed-equivalent-material.json). A synthetic10×10×40mm bar with Ez3e9Pa at100N verifies analytical displacement0.04/3mm and reaction-100N through the actual Worker. Save/archive/reload/reanalysis compares displacement,constants,axes and recordID. This is numerical implementation validation, not printed-part calibration or physical accuracy.

Remaining work requires recorded printer/material batch/build direction/environment/layer height/wall thickness/infill,calibrated force/displacement/dimensional measurements,raw stress-strain data and instrument versions,identification procedure/version,validity range and independent specimens excluded from fitting with uncertainty. Detailed wall/layer/infill models and measured comparisons remain unfinished. No measurement data were supplied here.
