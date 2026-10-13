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

Structural vibration, impedance/absorption boundaries, open boundaries, radiation, cavity eigenmodes, transient waves, auralization, flow noise and structural-acoustic coupling remain unimplemented. The uniform volumetric loss factor is not a material absorption coefficient. Iterative failures near resonance stop with an error; results do not guarantee physical sound levels.
