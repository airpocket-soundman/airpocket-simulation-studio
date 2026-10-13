# Volume meshing, structural and thermal analysis

[日本語](../analysis-guide.md)

## Input and meshing

Use STEP or built-in solids/examples. Internal geometry coordinates are mm. Original STEP is retained in project files for remeshing. STL currently supports viewing/region setup, not volume meshing.

Enter a target size in mm and generate a volume mesh. Gmsh WASM 0.3.0 generates first-order tetrahedra; inspect node/element counts, total volume and minimum minSICN quality. The internal-mesh toggle reveals internal elements. Current limits: 30,000 elements and 120 seconds per job.

A Service Worker enables browser isolation. A first visit to Pages may reload once. Unsupported environments fail with a diagnosis. GPU is used for rendering; meshing and calculation use the local CPU.

## Structural

Define fixed regions and total forces with global directions. Registered modulus/Poisson ratio feed linear isotropic small-deformation elasticity. Constrain every disconnected solid sufficiently. Contact, rubber large deformation, plasticity and fracture are not supported.

Airpocket Tet4 is the repository's own engine. Element assembly and PCG control are JavaScript; the WASM CPU option executes double-precision matrix operations in WASM. JavaScript PCG and stricter convergence are alternatives of the same physical engine, not different solver products. CalculiX/Elmer are not integrated.

The structural example uses a reference-only material and 100 N axial force: expected displacement 0.04 mm and reaction -100 N. Display displacement/stress maps, deformation scale and maxima. Stress maps use nodal averaging; peak stress is an element value. Validate mesh convergence for other models.

## Partial regions and adaptation

Transfer selected display triangles through projection of analysis-surface centroids. Reject transfers exceeding 15% area error or the projection-distance threshold and request refinement. Exact CAD splitting/dimensional regions remain unimplemented.

Adaptive mode combines recovered-stress variation, strain and displacement to set local sizes, regenerate the actual mesh, transfer boundaries and solve again. Stop on displacement-change/stress-variation thresholds or iteration/element/time limits. This is not a certified error bound or a guarantee of a mathematically optimal mesh. Preserve history and stop reason.

## Thermal

Select thermal analysis and define temperature (°C), heat flux (W/m², positive inward) and volumetric heat (W/m³). Do not mix structural constraints/forces with thermal conditions. Steady conduction needs conductivity; transient conduction also needs density, specific heat, time step, step count and initial temperature. Integration uses backward Euler and lumped mass.

The thermal example establishes a linear 20–100 °C field. Display temperature, heat flux, residual and energy-balance error; exported results retain time history. Convection and total surface heat input are supported. Radiation and contact resistance remain unimplemented.

## API and validation

Expose window.analysisApi.generateMesh({size:4}), analyze({size:4,method:'wasm-pcg',adaptive:true,maxRounds:3}) and cancel(). Discipline, properties and boundaries come from studioApi's project state. loadExample/loadThermalExample configure references. Results include frozen input and export as JSON.

Tests cover volume preservation, size changes, region area/resultant force, axial reference displacement, bending error reduction, reactions, JS/WASM agreement, real adaptation, steady temperature/flux and transient response. The refined cantilever test is within 15% of its beam reference under that test's conditions; this is not an accuracy guarantee for arbitrary models.

## Acoustics

Choose Acoustic example, then Run analysis to display pressure, SPL or phase. Enable frequency sweep in acoustic details and enter the receiver position and frequency range. Model the medium through which sound travels as the solid domain. Select Probe and click the 3D results surface to measure a location. See [numerical model and limits](acoustics.md). The API also exposes loadAcousticExample.

### Convection and total heat input (v0.4)

Set coefficient h (W/m²K) and ambient temperature (°C) on a selected surface. Outward convection is h(T−ambient). Supply h for the relevant flow, orientation and surface conditions; it is not inferred from material. Overlapping convection regions are rejected to avoid double counting.

Total heat input (W) is distributed by selected area while preserving its total. This differs from flux (W/m²) and volumetric heating (W/m³). Positive is inward, negative outward. Unspecified surfaces are insulated. Every disconnected steady body needs temperature or convection anchoring. Transient heat can run without fixed temperatures using initial temperature and heat capacity.

Cooling example: 40 mm length, 10×10 mm cross-section, k=2 W/mK, base 100 °C, tip h=100 W/m²K/ambient 20 °C, insulated sides. Reference tip 46.667 °C and outward heat 0.266667 W. Energy balance is applied heat + inward convection + prescribed-temperature reaction − storage rate. A negative convection term means cooling. History retains convection and stored energy.

After selecting a region, call `studioApi.addCondition({type:'convection',value:100,ambientTemperature:20})` or `studioApi.addCondition({type:'heatPower',value:1})`. Load the reference with `analysisApi.loadConvectionExample()`.

## Manual local refinement (v0.5)

Select a face or curved brush region, open Refine mesh near selected regions and register local target size/influence radius in mm. Regenerate or solve again. Spherical size fields start at triangle centroids and smoothly return to global sizing at the radius. At most80 centers/registration and160 total. This is not exact CAD splitting; local size must be15–100% of global size.

Settings persist in the project and combine with adaptive sizing. Replacing geometry clears them. Minimum minSICN quality and elements below0.2 are shown; exported mesh summaries include the complete histogram. These metrics do not guarantee numerical accuracy.

API: `studioApi.setMeshSettings({refinements:[{center:[5,5,40],size:2,radius:12}]})`, all dimensions in mm. In Node, `selectedRefinements(project,{size:2,radius:12})` builds fields from a selection.

## Pressure, normal traction and gravity (v0.6)

Set pressure or normal traction on selected surfaces. UI units are kPa; storage/API uses Pa. Positive pressure is inward; positive normal traction is outward. Negative values reverse the direction. These are loads per area, distinct from total force in N. Outward normals use the adjacent tetrahedron, independent of display triangle winding.

Enter gravity/uniform acceleration in global m/s². All solids share registered density (kg/m³). Each element distributes its density × volume × acceleration to its nodes. Disable gravity when unused. Remeshing rebuilds loads; reactions include both surface and body forces. Each disconnected solid needs at least three non-collinear fixed nodes; support through contact is not implemented.

Reference:10×10×40 mm, E=1 GPa, ν=0, ρ=1000 kg/m³, upper-face pressure1 MPa, acceleration[0,0,−10] m/s². Pressure100 N + body force0.04 N produces reaction100.04 N and reference maximum displacement0.040008 mm. Results display/export applied force, body force and reactions.

A radius12 mm/length60 mm half-cylinder under100 kPa has projected-area resultant144 N. Tests require vector error below2% and reduced error when size changes from5 to2 mm. This is specific validation, not a general accuracy guarantee. Partial regions retain surface projection/area-error limits.

After selection, call `studioApi.addCondition({type:'pressure',value:1e6})` or `{type:'normalTraction',value:1e6}`. Set gravity with `studioApi.setStudy({...study,kind:'structural',gravityEnabled:true,gravity:[0,0,-9.80665]})`. `gravityEnabled:false` disables it; API studies specifying only a gravity vector enable it. Load the reference using `analysisApi.loadPressureExample()`.
