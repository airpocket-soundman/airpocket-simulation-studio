# Images and animations

[日本語](../visual-export.md)

Open **Save images and animations** to save the current view as PNG or animation as WebM. Model-only PNG and orbit are supported. Images include model name, range/units and section information, with a maximum width of 1920 pixels.

Combine result surface, surface triangles, internal mesh and clipping. Exports use the current rendered view. Hide the surface to show internal mesh alone.

Four types: orbit, structural/modal deformation cycle, stored transient acoustic frames, moving section. Set 1–15 seconds and choose playback or WebM recording. Recording requires MediaRecorder support and selects available VP9/VP8 codecs. Completion/stopping restores camera, deformation scale, section and time.

Deformation cycles scale stored displacements without recalculating load histories or nonlinear trajectories. Modal shapes are normalized to 1 mm maximum displacement, not physical amplitudes. Transient playback labels physical snapshot times; video time is stretched to the chosen visualization duration. Frame rate depends on rendering performance. Direct GIF/MP4 exports and streamline/particle animation are not implemented.

The fixed-frame PNG-sequence (`png-sequence`) ZIP is byte-identical when the same input is solved again. `resultRevision` includes the wall-clock `result.performance.solveMs`, so it changes with every fresh solve (it is the value stored case, measurement and named-view records rely on, and it is unchanged). `getResultView` therefore also returns `physicalRevision`, the SHA-256 of the same output with `result.performance` removed. The in-ZIP `manifest.json` (`schemaVersion` 2) records `physicalRevision`, per manifest and per frame, instead of `resultRevision`. The artifact metadata `manifest` keeps `resultRevision` and adds `physicalRevision`. `schemaVersion` 1 ZIPs (recording `resultRevision`) remain readable.
