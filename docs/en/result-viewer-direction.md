# Result viewer and export requirements

[日本語](../result-viewer-direction.md)

Date: 2026-10-14. Proposed product requirements: make results understandable, useful for design decisions and easy to communicate. Visualization does not establish support for an unimplemented analysis.

Current features include surface results, surface/internal meshes, sections, probes, PNG/WebM and orbit/deformation/stored transient-acoustic/moving-section animations. Direct MP4/GIF, streamlines and particle animations remain unsupported.

## Layers and interaction

Provide independent visibility and opacity controls for original parts, result color maps, surface/internal wireframes, deformed geometry, sections, vectors, contours/isosurfaces, streamlines/particles and annotations. Select quantity/component/units, color map and fixed range. Show deformation scale and normalization. Provide domain-specific presets with advanced controls rather than exposing every setting initially. Check transparency/depth behavior and offer sections where useful.

## Time and flow

Support play/pause, stepping, time input, selected intervals, playback speed, loops and probe history. Default to a fixed color range across the selected interval and allow shared ranges across cases. Label per-frame auto-ranging.

Combine velocity color maps, sampled arrows, streamlines/particles and pressure section contours or isosurfaces. Allow every-element arrows but use sampling by default. Seed from inlet faces, points, lines or regions. Steady-field particle animation must be labeled as visualization of a steady velocity field. Transient pathlines require integration through stored time-dependent velocity fields. Interpolation does not increase solved temporal resolution. Define stopping at walls, outside the domain and at stagnation.

Static deformation cycles and normalized modal animations are not dynamic response. Structural transient animation requires computed/stored history. Expose available representations according to result type.

## Camera and export

Save an interactively selected camera and support fixed, orbit and keyframed cameras. Configure physical time interval, playback duration, FPS, resolution, background, layers, legend, annotations and time labels. Offer PNG, WebM/MP4 and short GIF previews. Detect actual browser encoding support; provide WebM, PNG sequences or optional native conversion when MP4 is unavailable. Download GIF/encoding modules on demand and report size/memory limitations.

Where supported, render frames at fixed times for deterministic export, separately from real-time recording. Support preparation estimates, progress, cancellation and restoration. Include units, physical time, deformation scale and provisional status in outputs.

## Reproducibility and agents

Save camera, layers, color ranges, sections, seeds, interval and annotations with result identity/version. Proposed API/MCP operations expose viewer capabilities, presets, view configuration, probes, time selection and export preparation/run/progress/cancel. Preserve numerical JSON/CSV alongside media. Consider interactive result packages containing results, view settings and a viewer; publication/sharing is a separate action.

Prioritize layer/preset/view persistence, time-range and frame export, vectors/contours/steady flow, then transient pathlines/isosurfaces/synchronized comparison/packages. Verify vectors and contours against known fields, distinguish steady and transient paths, check frame timing/camera/ranges/scales and cancellation recovery, and measure rendering/export time and memory with sampling and Worker support.
