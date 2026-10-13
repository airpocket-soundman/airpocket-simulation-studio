# Vibration and acoustics

[日本語](../acoustics.md)

v0.3 implements frequency-domain acoustics in a uniform medium. The interior of an imported STEP solid is the acoustic domain. Airpocket Acoustic Tet4 solves the complex Helmholtz equation using linear tetrahedra and BiCGStab, with WASM or JavaScript matrix products. This is not a port of Elmer or Code_Aster.

## Available features

- Prescribed real peak pressure on selected surface regions; unspecified walls are rigid.
- Frequency, sound speed, medium density, volumetric loss factor and reference pressure.
- 3D peak pressure, phase and SPL. SPL uses RMS (peak divided by √2), defaults to 20 µPa reference and has a plotting floor of 1e-12 Pa RMS.
- Coordinate-based interior receiver, up to 20 sweep samples, surface-click probes and JSON input/result export.
- Reject mesh target sizes above one sixth wavelength. This is a guard, not an accuracy guarantee; convergence checks are still required.

## Validation and limits

For a 10×10×40 mm pipe with 1 Pa/0 Pa ends and rigid sides, the 2 kHz solution differs from its sinusoidal reference by less than 0.006 Pa at each node. A 500–3000 Hz receiver sweep matches between WASM and JavaScript within 1e-7 Pa. Pressure display, sweep table and surface probes were verified through the UI.

[Exterior radiation/directivity](exterior-acoustics.md), [transient waves/WAV](transient-acoustics.md), [structural natural modes](modal-analysis.md) and [one-way box-mode acoustics](vibration-acoustics.md) are implemented. Direct acoustic cavity eigenvalue extraction, flow noise and general curved/two-way coupling remain unimplemented. The uniform volumetric loss factor is not a material absorption coefficient. Iterative failures near resonance stop with an error; results do not guarantee physical sound levels.

## Resonance validation (v0.5)

The 20×20×40 mm cavity prescribes 1 Pa on one face and rigid conditions on the other five. At 343 m/s, first resonance is c/(4L)=2143.75 Hz. With volumetric loss 0.02, computed peak 63.275 Pa matches reference 63.662 Pa within 2.5%. The pipe with 1 Pa/0 Pa ends resonates at c/(2L)=4287.5 Hz; peak 30.453 Pa matches 31.831 Pa within 6%. Tests require peaks more than ten times neighboring-frequency responses.

This validates frequency responses for specific boundaries/dimensions/meshes, not direct eigenfrequency extraction for arbitrary geometry. Real resonance depends on driving, absorption and openings. References are p(z)=cos(k_eff(L−z))/cos(k_eff L) for the cavity and p(z)=sin(k_eff(L−z))/sin(k_eff L) for the pipe, with k_eff²=(2πf/c)²(1−iη). Elmer itself is not ported; these calculations use the repository's OSS engine.

### Complex impedance absorbing boundaries
Assign resistance R>0 and reactance X in Pa·s/m to selected faces using a locally reacting impedance Z=R+iX. Optional JSON tables contain 2–100 ascending [Hz,R,X] rows. Values are linearly interpolated within the measured range without extrapolation. An absorption coefficient alone does not determine complex impedance. With exp(+iωt), the weak boundary contribution is iω/Z times the consistent triangle surface mass matrix. Time-averaged absorbed power uses peak complex pressure. Overlapping prescribed pressure and impedance on the same face, or duplicate impedance faces, are rejected. The matched pipe example uses ρc=411.6 Pa·s/m and checks an outgoing wave. General exterior radiation/directivity (ACOU3) remains unsupported. Formulation reference: [FEniCSx Helmholtz tutorial](https://jsdokken.com/dolfinx-tutorial/chapter2/helmholtz.html).
