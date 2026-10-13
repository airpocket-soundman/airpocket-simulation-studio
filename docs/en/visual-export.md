# Images and animations

[日本語](../visual-export.md)

Open **Save images and animations** to save the current view as PNG or animation as WebM. Model-only PNG and orbit are supported. Images include model name, range/units and section information, with a maximum width of 1920 pixels.

Combine result surface, surface triangles, internal mesh and clipping. Exports use the current rendered view. Hide the surface to show internal mesh alone.

Four types: orbit, structural/modal deformation cycle, stored transient acoustic frames, moving section. Set 1–15 seconds and choose playback or WebM recording. Recording requires MediaRecorder support and selects available VP9/VP8 codecs. Completion/stopping restores camera, deformation scale, section and time.

Deformation cycles scale stored displacements without recalculating load histories or nonlinear trajectories. Modal shapes are normalized to 1 mm maximum displacement, not physical amplitudes. Transient playback labels physical snapshot times; video time is stretched to the chosen visualization duration. Frame rate depends on rendering performance. Direct GIF/MP4 exports and streamline/particle animation are not implemented.
