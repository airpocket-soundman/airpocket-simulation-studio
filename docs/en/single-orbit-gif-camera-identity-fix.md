# Orbit GIF camera identity correction

[日本語](../single-orbit-gif-camera-identity-fix.md)

The 2026-10-27 real UI attempt at fixed source 35922baf created 24 frames but failed final proof validation. No public artifact was produced and no additional actual export was run. Its historical completed label described the generation stage, not successful artifact publication.

The public view API canonicalizes camera numbers to 12 significant digits, whereas GIF proof retained raw coordinates. An actual Three.js OrbitControls numerical update, without a renderer, reproduced 61 becoming 61.00000000000001. The actual attempt did not retain the raw proof camera, so this reproduced inconsistency cannot establish the sole forensic cause of that failure.

GIF now reuses canonicalViewState before deriving its plan, rendering camera and private proof. Finally restores the original raw camera. A materially different camera still refuses, as does an input whose canonical fov reaches 180. Final validation retains GIF_ORBIT_INVALID with bounded component-specific reasons and no values. API generation now says GIF frames created; the GUI download completion label remains separate.

Regression checks cover real OrbitControls ULP drift, the public camera canonicalization, a thermal interpolated 2-second job with null frame/mode, different-camera refusal, the initial planned coordinate, and Japanese/English generation-stage labels. Relevant tests passed 126/126, zero failures or skips, in 8.3567 seconds, including types and layer checks. Additional real GUI, external codec, solver and product exports: zero. Successful actual artifact validation remains pending.
