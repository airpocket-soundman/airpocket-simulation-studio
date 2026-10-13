# Vibration and acoustics

[日本語](../acoustics.md)

Distinguish solid vibration, sound propagation in air/other media and flow-generated sound. Planned features: natural frequencies/modes, forced frequency response and damping; acoustic domains, source faces, pressure/normal-velocity excitation and receivers; cavity/pipe resonance, sweeps, pressure amplitude/phase and response curves.

Configure rigid walls and frequency-dependent impedance/absorption. Record sound speed, density, damping and temperature, plus dynamic structural properties. Sound pressure levels must state reference pressure, RMS/peak convention, frequency and any weighting; air/water references differ.

Later add vibration radiation, coupled vibroacoustics, directivity and transmission loss. Validate open boundaries and domain-size convergence for external acoustics. Consider dedicated BEM only when needed. Flow noise, transient waves, impulse responses and auralization are later milestones; a single-frequency pressure result does not establish audible timbre.

Elmer’s Helmholtz model is the first candidate; Code_Aster is an additional candidate. Browser builds are not yet validated. Structural transfers must preserve frequency, complex amplitude, phase and normal velocity.

Benchmark against rectangular cavity modes, pipe resonance with specified boundaries and known wave solutions. Size meshes for the highest frequency and sweeps to capture resonance peaks. Do not present undamped infinite/very high peaks as real measured SPL. [Elmer models manual](https://www.nic.funet.fi/pub/sci/physics/elmer/doc/ElmerModelsManual.pdf).
