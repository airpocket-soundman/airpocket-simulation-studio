# Feature introduction video (Japanese edition): script and production notes

[日本語](../intro-video.md)

Script and production memo for a roughly three-minute feature introduction video (Japanese narration, 1920×1080, 30 fps, MP4) that shows only analyses the app actually runs. The video and its frame material are kept outside the repository (a work folder under the user's Videos folder); only this document is tracked. An English-narration edition has not been made yet.

## Deliverable

| Item | Content |
| --- | --- |
| Video | `Videos\airpocket-intro\out\airpocket-intro-ja.mp4` in the work folder (about 179 s, H.264/AAC, about 49 MiB) |
| Source of footage | This repository's `main` (the app header shows v0.43; the prebuilt WASM was copied read-only from the existing checkout), served from a separate worktree by the Vite dev server at `http://127.0.0.1:5190` |
| Capture | Real Chrome driven by Playwright; JPEG-quality-95 frames saved from the Chrome DevTools screencast and assembled into 30 fps MP4 by ffmpeg. Clicking the demo buttons, `Run analysis` and the result `Play` animation are real GUI operations |
| Voice | Windows built-in text-to-speech (System.Speech, `Microsoft Haruka`, rate 0). Nothing was uploaded to any external service |
| Compositing | ffmpeg 9.0.1 (installed with winget). Overlays (tags, captions, cards) are drawn with Pillow. The BGM is a quiet pad synthesized from sine waves by ffmpeg (no external material) |

## Script (narration, Japanese originals with English glosses)

Character counts include punctuation; speed is measured from the recorded audio (about 4.4–5.6 characters/s). Each scene has 0.3 s of lead and 0.7 s of tail.

| # | Time | Chars | Narration (gloss) |
| --- | --- | --- | --- |
| s0 Opening | 30.7 s | 167 | A browser-based CAE app for structural, thermal, acoustic, modal and fluid analysis: load a model, set conditions, compute and inspect results in 3D; connect your own LLM through MCP or the API to delegate operations. |
| s1 Structural, linear elastic | 13.6 s | 64 | Linear elasticity gives colored displacement and stress in 3D; this example's maximum displacement is 0.04 mm, matching the reference solution. |
| s2 Plasticity / hyperelasticity | 12.9 s | 59 | Elastoplasticity for metal yielding and hyperelasticity for rubber-like large deformation, applying the load in steps. |
| s3 Thermal | 9.0 s | 48 | Heat conduction from 20 °C and 100 °C boundary temperatures, with the energy-balance error reported. |
| s4 Acoustics | 14.0 s | 66 | Three kinds: frequency-domain harmonic response, time-domain transient propagation and exterior radiation from a spherical source; sound pressure and sound pressure level. |
| s5 Modal | 11.7 s | 55 | Natural frequencies and mode shapes; the first mode of this cantilever part is about 278 Hz. |
| s6 Fluid | 12.8 s | 57 | Laminar channel flow and Stokes flow around a sphere; turbulent and compressible flow are not supported yet. |
| s7 Fatigue / fracture assessment | 12.2 s | 67 | Results can feed fatigue and brittle-fracture assessment; the data used are fictitious reference data, not a guarantee of life or fracture. |
| s8 Cases / export | 10.9 s | 61 | Results are saved as cases and compared side by side; the displayed view can be exported as PNG or WebM. |
| s9 MCP / API | 21.1 s | 106 | The app provides an API and MCP; your own LLM can inspect the model, set conditions, run analyses and fetch results within the operations you allow, and inputs are checked for grounds before running. |
| s10 Summary | 19.1 s | 84 | Five disciplines in one browser tab; turbulent/compressible flow, contact and GPU computation are not supported yet. |

Total narration is 168.0 s; with margins the video is 179.1 s.

## App operations and solvers per scene

All scenes use the app's demo buttons and real GUI operations. `Run analysis` is `#solve-run`; animations are the result view `Play` (`#animation-preview`). To focus on results, the side panels were hidden by CSS after solving in some shots (“zoom”), while others keep the full real screen (“full UI”).

| Scene | Demo button | Operation | Solver / result | Numbers shown |
| --- | --- | --- | --- | --- |
| s0 | Short clips of the demos below | Title card, then a montage per discipline | Structural, thermal, acoustic, modal, fluid | Tags only |
| s1 | Analysis sample | Load demo, run, deformation animation (full UI, then zoom) | Structural linear elasticity (tetrahedral mesh) | Max displacement 0.0400 mm, max von Mises 1.00 MPa, reference 0.04 mm |
| s2 | Elastoplastic tension / rubber large deformation | Run, show plastic strain, deformation animation | J2 elastoplasticity (isotropic hardening) / hyperelasticity (Neo-Hookean) | 0.121 mm, 251.7 MPa / prescribed displacement 8 mm |
| s3 | Thermal sample | Run, temperature field, orbit animation | Steady heat conduction | 20 → 100 °C, energy-balance error 3.6e-11 W |
| s4 | Acoustic / sound propagation / sphere source exterior radiation | Run, SPL field, orbit / time animation | Harmonic (2000 Hz), transient (4 ms, 2138 steps), exterior radiation (1000 Hz sphere) | Max SPL 90.97 dB / receiver peak 1.0024 Pa / radiated power 4.2e-7 W |
| s5 | Natural-vibration sample | Run, deformation animation | Modal analysis | 277.9 Hz / 278.7 Hz |
| s6 | Laminar channel / sphere creeping flow | Run, speed field, orbit / orbit with the analysis mesh shown | Channel laminar flow (PCG) / 3D steady Stokes flow (P1) | Re 69.9, flow difference 0.17 % / Re 0.01 |
| s7 | Uniaxial fatigue reference / fictitious brittle-fracture reference | Run, then “fatigue-evaluate the displayed result” / “brittle-fracture-evaluate the displayed result” | S-N fatigue assessment; LEFM mode-I fracture assessment | Min life 1.0e6 cycles, max damage 0.1 / KI/KIC 0.59 → 1.77 |
| s8 | Analysis sample, then thermal sample | Run each and register with “save current result” as cases; show the case list | Case comparison | Two cases managed on one screen |
| s9 | (none) | Open “Connect your own LLM” and press “Diagnose connection” (not connected); then cards showing part of the real `tools/list` response of `node scripts/studio-mcp.mjs` (29 tools) and a connection diagram | MCP / API (no solver) | 29 tools |
| s10 | Footage of structural, acoustic and modal, then the end card | — | — | List of unsupported areas |

PNG / WebM export (`view-png`, `animation-save`, `startExport`) was **not executed** for this video. The s8 narration only states that these features exist; no exported result is shown.

## Notes on unsupported / unverified areas

Captions and the end card state the following, and the narration says turbulent/compressible flow, contact and GPU computation are not supported.

- Turbulent and compressible CFD, contact analysis, print (fabrication) analysis, GPU computation and connection from the public HTTPS site are unsupported or unverified and are not shown.
- Every example is a reference demo (input grounds not recorded: legacy input). The fatigue and fracture material data are fictitious and give no guarantee of life or fracture.
- No real LLM was connected in the MCP scene; it shows the connection panel (not connected), the MCP server tool list and a conceptual diagram.
- Color maps are the display of reference examples, not evidence of physical validity.

## Production steps

The work folder is `C:\Users\<user>\Videos\airpocket-intro` (outside the repository).

1. **Environment**: in a dedicated worktree run `npm ci`, `node scripts/build-kernel.mjs` and `node scripts/copy-cad.mjs`; copy the prebuilt `public/mfem` (WASM) read-only from the existing checkout (rebuilding native code is heavy). Start `npx vite --host 127.0.0.1 --port 5190 --strictPort` on a separate port to avoid clashing with other work. Use the winget-installed `ffmpeg`. Only `playwright-core` was installed in the work folder, driving the installed Chrome (no browser download).
2. **Script**: `narration.json` (scene IDs and narration).
3. **Capture**: `scenes.mjs` (solver scenes) and `ui_scenes.mjs` (fatigue, fracture, cases, connection panel). The scripts open the page, click the demo button, `#solve-run`, wait for completion, set the result field and animation kind, press `#animation-preview`, and save CDP screencast frames (JPEG 95).
4. **Voice**: `tts.ps1` (one WAV per scene with `Microsoft Haruka` in `System.Speech`).
5. **Compositing**: `blib.py` (overlays and cards), `build.py` (scene definitions to ffmpeg cropping/zoom, captions and per-scene audio placement), `final.sh` (concatenation, BGM mix, output `out/airpocket-intro-ja.mp4`).
6. **Checks**: visual review with a frame sheet every 7.5 s; measured peak level −0.4 dB.

## What was and was not made

- Made: a roughly three-minute Japanese-narrated MP4 covering structural (linear elastic, plastic, hyperelastic), thermal, acoustic (harmonic, transient, exterior radiation), modal, fluid (channel, Stokes), fatigue and brittle-fracture assessment, case comparison, and MCP / API connection (panel and tool list).
- Not made or simplified: a demonstration of PNG / WebM export, a demonstration of a real LLM operating the app, a velocity-field visual for the Stokes flow (replaced by the analysis mesh because the surface view showed the box exterior as a single color and hid the interior), assessment features other than fatigue and fracture, and the English edition (later). Listening checks of BGM and narration were limited to level measurement; a final human listen is not done.
