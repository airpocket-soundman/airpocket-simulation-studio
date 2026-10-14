# STEP updates and condition reconciliation

[日本語](../cad-update.md)

v0.41 adds Update CAD and reconcile conditions for projects with an original STEP solid. Choose the updated STEP, review the per-condition report, then apply it. Importing and previewing do not replace the current model. Applying retains material properties, load/temperature values, directions/local frames, study settings and local refinement settings, and clears the current result. Saved cases retain their original inputs and results.

Matching compares location, area, centroid, orientation and geometry independently of face numbers or part order. Planar boundary loops ignore collinear intermediate vertices, allowing different triangulations. Curved faces require the same oriented display-triangle set. Partial selections transfer only if their actual triangles remain identifiable. Dimensional regions require a matching parent face and reproducible dimensions. Missing, duplicate, split/merged or changed faces are not replaced using numeric face indices.

## Repair unresolved regions

Unmatched conditions remain present with their values and directions. A condition spanning several faces becomes entirely unresolved if any region cannot be matched. Select new regions and press that condition's Update with selection button. Analysis becomes available after every unresolved condition is repaired. Explicitly deleting a condition removes it from the study.

Pending projects can be exported and reloaded. The UI, browser analysis client, Worker, boundary transfer and case storage reject unresolved numerical analysis. Meshing remains available.

## Scope and limits

This compares display geometry; it does not track persistent B-rep IDs or CAD feature history. Length tolerance is `1e-7 × max(1, face span in mm)` and area tolerance is relative `1e-6`. Changes below display precision, changed curved tessellations and deformed design faces are not guaranteed to match. Ambiguous correspondence requires reselection.

Use STEP/STP files up to 50 MB and up to 2000 display CAD faces per model. Anonymous faces, STL, generated Gmsh surfaces and direct fluid-domain updates are unsupported. Disconnect saved temperature fields or vibration sources before updating and reconnect them afterward. Staged updates become invalid when the current model or conditions change.

The shared API provides read-only `previewCadUpdate({name,sourceModel,meshes})`, returning per-condition `matched`/`needs-reselection` reports and counts, and `applyCadUpdate(...)`, which reconciles the current state again before applying. Supply Base64 source data and display faces parsed from the same STEP. Pending conditions retain a `cadUpdateRequired` marker; `replaceConditionRegion(index)` registers the new selection and clears it.

Tests cover face renumbering, retessellation, reordered parts, missing/duplicate faces, distinct concave outlines with equal bounds/area/centroid, partial and dimensional regions, archives and analysis rejection. An actual 10×10×40 mm STEP bar at 100 N, E=1 GPa and ν=0 retains 0.04 mm axial displacement after an unchanged update. Updating its length to 50 mm and repairing the load face gives 0.05 mm.
