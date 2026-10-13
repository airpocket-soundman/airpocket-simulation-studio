# Transient acoustics

[日本語](../transient-acoustics.md)

Use **Sound propagation example** to integrate uniform-medium pressure over physical time. Results include receiver traces, a 3D pressure time slider and normalized WAV. A 4 ms record remains a short sound: playback never stretches time. Physical pressure in Pa is independent of playback volume.

## Method

The SI weak form is `M p¨ + D p˙ + K p = 0`. Lumped Tet4 mass contributes `V/(4ρc²)` per node; stiffness is `V/ρ ∇Ni·∇Nj`. Unspecified walls are rigid. Constant positive real impedance Z adds diagonal damping `A/(3Z)`. Spherical exterior radiation uses `∂p/∂n = -p/R - p˙/c`, with lumped surface stiffness and damping. Finite-boundary error remains for general fields.

Central differences advance pressure and center damping about time n. An absolute row-sum bound on `M⁻¹K` gives the conservative restriction `Δt ≤ 0.9 × 2/√bound`. Automatic steps are shortened to land on the record endpoint. Larger user steps are rejected. Stability does not guarantee accuracy: lumped elements introduce dispersion.

Prescribed pressure is an amplitude times `cos(2πf(t−6σ)) exp(−(t−6σ)²/(2σ²))`, zero before time 0 and after 12σ. UI initial pressure/velocity are zero. Every tet edge must be no longer than one sixth of the wavelength at `f + 3/(2πσ)`. This three-sigma bandwidth estimate is not a strict spectral cutoff.

Receiver pressure uses tetrahedral interpolation and is recorded each step. Full-record RMS uses trapezoidal integration; instantaneous pressure is never labelled harmonic SPL. Up to approximately 61 field snapshots are retained. Windowed-sinc low-pass resampling produces peak-normalized 44.1 kHz mono PCM16 WAV, without speaker calibration or a different medium's transfer response.

## API and scope

Set `study.kind: 'acoustic'`, `acousticTransient: true`, `acousticDuration` (seconds), `pulseWidth` (seconds), `acousticTimeStep` (seconds; 0 = automatic), `dampingRate` (1/s), `frequency`, `soundSpeed`, `airDensity` and `receiverPoint` (mm). Results have kind `acousticTransient`; saved cases restore traces and 3D frames.

Harmonic `lossFactor` must be zero; sweep and far field must be disabled. Volume damping is separately `2 × dampingRate × M`. Frequency-dependent/complex impedance, structural vibration coupling, heterogeneous media, PML, GPU, MFEM and adaptation are unsupported. Limits: 3,000 nodes, 10,000 tetrahedra, 60,000 steps and 60,000,000 node-steps. Cancellation terminates the common analysis Worker.

## Verification

Tests compare cavity modes with `c/(2L)` under mesh refinement; matched-outlet arrival and amplitude with `distance/c`; radiating sphere pressure with `a/r`; amplitude linearity; JS/WASM agreement; unstable-step rejection; archive corruption rejection; WAV physical duration/frequency, silence and anti-alias filtering. See `tests/acoustic-transient.test.mjs`, `tests/acoustic-audio.test.mjs` and `tests/worker-pipeline.test.mjs`.

Central difference/lumped mass background: [Noh & Bathe, Computers & Structures 129 (2013)](https://web.mit.edu/kjb/Desktop/kjb/OldFiles/www/Principal_Publications/An_explicit_time_integration_scheme_for_the_analysis_of_wave_propagations.pdf). This implementation uses ordinary central differences; it does not port that paper's proposed integration scheme.
