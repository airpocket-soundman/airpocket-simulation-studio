# Vibration modes to exterior acoustics

[日本語](../vibration-acoustics.md)

Calculate natural modes and save a case. Switch the discipline to **Acoustics**, open **Acoustic domain / frequency → Use a vibration mode as a sound source**, and select the case, mode number, maximum amplitude and phase. **Create exterior acoustics from saved mode** surrounds the original solid with spherical air. **Run analysis** to view pressure, phase, radiation power and far-field directivity. Save the coupled input/result as a case.

## One-way model

This implements **a saved box-solid mode driven at a prescribed amplitude, coupled one way into sound**. An eigenmode does not determine response amplitude; the user supplies the peak displacement. Frequency is fixed to the saved mode. Forced frequency response and acoustic pressure feedback to structure are not computed. Curved interfaces, multiple-mode superposition, damped forced response and two-way fluid added effects remain in `COUPLE4B`.

For `exp(+iωt)`, displacement `u` gives velocity `v=iωu`. With the fluid-outward normal n, `∂p/∂n=-iωρ(v·n)`; the weak RHS is `∫(-iωv·n) Ni dS`. Volume topology determines normals, and solid interfaces must point from air into the solid. Display triangle winding is not used.

Saved structural Tet4 displacement is interpolated at independently meshed air-interface nodes. Planar interfaces place these nodes on the structural domain; points outside are rejected instead of using a nearest-point fallback. All six face areas are checked. Changed geometry, missing interfaces and reversed normals are rejected. Transferred nodal values are integrated linearly on each air facet, retaining nonmatching trace interpolation error.

Amplitude and phase propagate as complex quantities. Normal-velocity source power is `-1/2 Re ∫p v_n* dS`. With zero volume loss and no other sources, tests check agreement with radiation boundary absorption. The finite sphere uses a first-order condition; general vibration fields require enclosure-radius error studies.

## Scope and API

Structural source limits: 2,000 nodes and 8,000 tetrahedra, one unchanged box solid. Amplitude must be at most 1% of its shortest edge; the velocity bound is Mach 0.1. Manual pressure/impedance conditions may not overlap this full-interface source. Transient coupling and sweeps are unsupported. Harmonic loss and radiation approximation follow the existing acoustic model.

Save `study.vibrationSource` with `name`, zero-based `modeIndex`, `mesh:{nodes,tetrahedra}` (mm), `bounds:[x,y,z,dx,dy,dz]` (mm), global `displacement` normalized to maximum 1 mm, `frequencyHz`, `amplitudeMm` and `phaseDeg`. Use `study.kind:'acoustic'`, `exteriorRadiation:true`, and matching `frequency`. Result `coupling` retains face count/area, maximum normal velocity, amplitude and phase; `velocityInputPowerW` retains source power.

Tests cover matched-plane-wave pressure/phase, opposing normals and net flux, 180° phase sign reversal, JS/WASM agreement, source/radiated power, missing/changed geometry rejection, and a computed structural mode through the real Worker/archive path. Reference: [COMSOL Acoustic–Structure Interaction model](https://doc.comsol.com/6.4/doc/com.comsol.help.models.sme.acoustic_structure/acoustic_structure.html). This app currently implements only the structure-to-sound direction.
