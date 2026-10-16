# Result sections and point probes

Enable clipping under Interior view, select X/Y/Z, the position in mm and the retained side. Enable Show computed fields on section in Results to see the interior field. Temperature, displacement, velocity and pressure use tetrahedral shape-function interpolation. Stress and heat-flux colors use nodal averages; probes use the selected element value and can differ from averaged colors.

Choose Probe and click the section or result surface. Deformed display points map back to original model coordinates. Transient sound probes show instantaneous pressure at the selected time. Modal probes show the selected frequency and normalized displacement. Modal displacement has a maximum of 1 mm and is not a physical response amplitude.

Sections are display surfaces, not CAD faces for load or support assignment. Coincident original boundary faces are not duplicated. Section extraction runs on the CPU and large meshes can take time when moving the plane.

Verification: `tests/result-slice.test.mjs` checks area, affine interpolation, shared-face deduplication and deformed-coordinate mapping. `tests/probe.test.mjs` checks transient/modal values and explicit shared-face element selection. Browser checks cover the internal-channel section and point probe.

[日本語](../result-sections.md)

## Interpolated display between stored frames (GUI)

Transient acoustic results have, besides the stored-frame slider `#acoustic-time-frame`, a fine slider `#acoustic-time-fine` (stored range in 1000 steps) and a play/pause button `#acoustic-time-play`. Times between stored frames show linearly interpolated pressure and are labelled as interpolated. There is no extrapolation, and color ranges, physical arrays and stored results are unchanged. `setResultView` and image/video export still use stored frames only. Pure functions: `src/time-interpolation.js` ([Transient acoustics](transient-acoustics.md)).

See also: [Transient acoustics and stored thermal frames](transient-acoustics.md)
