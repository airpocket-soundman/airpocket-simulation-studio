# Volume meshing, structural and thermal analysis

[日本語](../analysis-guide.md)

## Input and meshing

Use STEP or built-in solids/examples. Internal geometry coordinates are mm. Original STEP is retained in project files for remeshing. STL currently supports viewing/region setup, not volume meshing.

Enter a target size in mm and generate a volume mesh. Gmsh WASM 0.3.0 generates first-order tetrahedra; inspect node/element counts, total volume and minimum minSICN quality. The internal-mesh toggle reveals internal elements. Current limits: 30,000 elements and 120 seconds per job.

A Service Worker enables browser isolation. A first visit to Pages may reload once. Unsupported environments fail with a diagnosis. GPU renders the scene; meshing uses the local CPU. Structure can use [WASM/independent MFEM](native-solvers.md) or [WebGPU with CPU correction](webgpu.md).

## Structural

Define fixed regions and total forces with global directions. Registered modulus/Poisson ratio feed linear isotropic small-deformation elasticity. Constrain every disconnected solid sufficiently. This linear mode excludes contact, plasticity and fracture. Use [Neo-Hookean mode](hyperelasticity.md) for compressible rubber finite strain.

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

Enter gravity/uniform acceleration in global m/s². All solids share registered density (kg/m³). Each element distributes its density × volume × acceleration to its nodes. Disable gravity when unused. Remeshing rebuilds loads; reactions include both surface and body forces. Full fixing requires at least three non-collinear nodes per disconnected solid. Directional supports must remove all rigid translation/rotation; support through contact is not implemented.

Reference: 10×10×40 mm, E=1 GPa, ν=0, ρ=1000 kg/m³, upper-face pressure 1 MPa, acceleration [0,0,−10] m/s². Pressure 100 N + body force 0.04 N produces reaction 100.04 N and reference maximum displacement 0.040008 mm. Results display/export applied force, body force and reactions.

A radius 12 mm/length 60 mm half-cylinder under 100 kPa has projected-area resultant 144 N. Tests require vector error below 2% and reduced error when size changes from 5 to 2 mm. This is specific validation, not a general accuracy guarantee. Partial regions retain surface projection/area-error limits.

After selection, call `studioApi.addCondition({type:'pressure',value:1e6})` or `{type:'normalTraction',value:1e6}`. Set gravity with `studioApi.setStudy({...study,kind:'structural',gravityEnabled:true,gravity:[0,0,-9.80665]})`. `gravityEnabled:false` disables it; API studies specifying only a gravity vector enable it. Load the reference using `analysisApi.loadPressureExample()`.

Pressure is a linear static load following original geometry normals. Follower loads using deformed normals are not supported.

## Directional constraints and prescribed displacement (v0.7)

Select a region, choose axis X/Y/Z and register a zero directional constraint or a displacement in mm. Other directions remain free and can receive additional conditions. Sign follows the selected axis.

Local frames use degree angles with fixed global X→Y→Z rotation order, matrix Rz Ry Rx. Projects retain the right-handed orthonormal frame and the constraint direction in global coordinates; the latter is shown in the condition list. Displacements always persist in mm and convert to meters in the solver.

Reference: a 40 mm bar, 10×10 mm cross-section, E=1 GPa, ν=0, fully fixed base. Rotate the local frame −90° about Y and prescribe 0.04 mm along local X (global Z) at the end. Reference stress 1 MPa; nodal reactions are 100 N on the actuated end and −100 N at the base, with zero overall reaction. Region totals include all support reactions at their nodes; overlapping regions can include a node more than once. Do not sum overlapping groups. These are not decomposed multipliers for individual constraint directions.

Tests cover rotated-coordinate Poisson contraction, JS/WASM agreement and save/restore. Nodal directions are orthogonalized and the stiffness is transformed for strong constraints; no penalty is used. Every disconnected component must remove six rigid modes. Conflicts, nearly parallel directions and insufficient supports are rejected. Directions are constant per region; varying surface-normal roller conditions, rigid links and contact remain unsupported.

API: `studioApi.addCondition({type:'displacement',value:0.04,direction:[0,0,1]})`. Value is mm and direction is normalized. Use `studioApi.frameFromEuler([0,-90,0],0)` (degrees and axis index) and register `{type:'displacement',value:0.04,frame}` for a local axis. `analysisApi.loadDisplacementExample()` loads the reference. Outputs include global nodal `constraintReactions`, region nodal `constraintRegionReactions`, and `forceBalanceErrorN` (applied + support force).

### Saved cases and comparison
Save up to eight named calculations and compare displacement/stress, temperature ranges, or pressure/SPL. JSON archives retain independent input, calculation settings and results. Cases live in session memory: export before closing. Duplicating/restoring input requires recalculation. Compare within the same physics and account for geometry and mesh differences. `window.caseApi` exposes `add / list / compare / export / import / remove`, shared with the UI.

Use "View saved result in 3D" to load archived inputs, mesh and results for color display, deformation and probing without recalculation. `window.caseApi.view(index)` performs the same action. Cancel any running calculation first. Invalid mesh or display fields are rejected before changing current inputs.

### Thermal expansion and stress
In structural analysis, enable Thermal expansion and stress and enter uniform part temperature and stress-free reference temperature. Register expansion (1/K). Each element includes isotropic thermal strain αΔT; constraints produce stress and reactions. The thermal stress example uses a 60 K rise, reference axial stress −0.6 MPa and end reactions ±60 N. The bottom also restrains lateral motion, so local stress differs from uniaxial stress. Node solveElastic accepts temperature (°C, scalar or nodal array) and referenceTemperature; linear Tet4 integrates the mean nodal temperature. Returned strains are total strain, thermalStrains are thermal strain, and stresses use total minus thermal strain.

Save a thermal case, set structural constraints and expansion on the same solid, then select Saved thermal case and Use temperature field for structural analysis. The final saved time step is interpolated using linear tetrahedral barycentric coordinates, allowing a different structural mesh size. Nodes outside the source thermal domain are rejected without extrapolation. Coupling is one way: structural deformation does not alter the thermal solution. Project and case archives retain the source field. Use transferTemperature(source,targetMesh) in Node or analysisApi.applyThermalCase(index) in the browser.

Radiation uses gray-body exchange with a large isothermal environment (view factor 1). Damped Newton iterations solve the Kelvin fourth-power law and reject nonconvergence. Inter-part radiation is unsupported. Thermal resistance supports coincident planar patches on two parts with separate nodes; overlap integration couples nonmatching triangulations. Gaps, overlaps and shared nodes are rejected. Contact pressure and friction are unsupported. The contact example reproduces 0.380952 W and interface temperatures 61.905 / 58.095 °C. Temperature transfer requires body identifiers.

## Fully developed laminar channels (v0.17)

The laminar channel example uses a built-in round pipe with viscosity 0.001 Pa·s, density 1000 kg/m³ and pressure drop 0.01 Pa. Reference peak speed is 0.006 m/s and flow is 1.35717e-6 m³/s. UI verification on 5,211 elements gave 0.006133 m/s, outlet flow 1.3031e-6 m³/s and 0.171% inlet/outlet imbalance.

For steady incompressible Newtonian fully developed unidirectional flow only, solve μ∇²u = −Δp/L with Tet4/PCG. Pressure is an imposed linear gauge-pressure profile from the specified drop, not a general coupled velocity/pressure solve. Walls are no-slip and end caps have zero axial velocity gradient. Built-in rectangular channels also support a selected axis; the built-in cylinder uses Y.

Fluid density, dynamic viscosity and sound speed are separate from solid material inputs. A conservative Re ≤ 1500 and peak-speed Mach ≤ 0.1 limit rejects out-of-regime cases. Compare end fluxes and refine the mesh; displayed imbalance is a numerical diagnostic. Other discipline boundary conditions cannot coexist. General STEP flow, entrance effects, bends, separation, turbulence and thermal-fluid coupling remain unsupported.

API: `analysisApi.loadFlowExample()`, `studioApi.setStudy({kind:'channelFlow', flowAxis, pressureDropPa, dynamicViscosity, fluidDensity, fluidSoundSpeed})`, `analysisApi.analyze()`. Node calls `solveChannelFlow(mesh,source,study,options)` directly. Velocity is node XYZ in m/s, speed in m/s, pressure in Pa and end fluxes in m³/s. Probes, archived cases, comparisons and saved views are supported.

Reference: [COMSOL round-pipe pressure-drop explanation](https://www.comsol.com/blogs/creating-app-modeling-flow-control-pipe-network).

For API probes on contact interfaces, specify the part, e.g. analysisApi.probe(point,{bodyIndex:0}). A point belonging to multiple bodies without an explicit part is rejected instead of returning an ambiguous value. UI probes track the picked face body in both setup and result views and report its index.

[Internal CAD extraction and cap ports](internal-fluid.md) uses X/Y/Z box planes and a seed-selected CAD volume. General 3D flow and arbitrarily oriented caps remain unsupported.

Saved thermal cases can be applied through window.caseSourceApi.apply/connected applyCaseSource with kind:temperature. Configure structural/thermalStress and exact solid identity first, then supply input/case revisions. Clear removes only the source, preserving other settings. See the [contract](automation.md).

LLM surface inspection uses connected inspectSurface or saved MCP studio_inspect_project.surfaceInspection. Problem triangles are paged and scoped to the returned input revision; passing closed-edge topology does not establish shape validity or volume meshing. See the [contract](automation.md).

Quantitative/exploratory conduction requires explicit k, steady/transient intent, volumetric source and all thermal-boundary evidence. Transient adds rho/cp/dt/steps/initial temperature. Runtime physical settings must match saved study; legacy/saved-assessment compatibility remains. See [thermal evidence contract](automation.md) and preflight.requiredPointers.

Acoustic-wave, fully-developed channel and exterior Stokes support quantitative/exploratory evidence contracts. Inspect requiredPointers for active settings/boundaries/original geometry; avoid ignored runtime sources or differing physical overrides. Legacy compatibility and postmesh checks remain. See the [contract](automation.md).

Stokes iteration progress distinguishes measured preconditioned, estimated Arnoldi and final original-equation residuals by phase/residualKind. converged does not establish flow balance, physical accuracy or job success. See [Stokes](stokes-flow.md).

Harmonic acoustics/frequency sweeps expose scalar BiCGStab residuals; fully developed channels expose PCG residuals through jobEvents. Acoustic frequencyHz/solvePhase and frequency-step start/complete identify the solve. Recurrence convergence does not establish job success or physical accuracy: inspect later checks and terminal state. No intermediate pressure/velocity field or physical-time axis is added. See the [observation contract](automation.md).
