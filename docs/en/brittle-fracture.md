# Brittle fracture with specified flaws

[日本語](../brittle-fracture.md)

v0.42 adds nominal-stress mode-I LEFM screening of a linear elastic result. It does not mesh or solve the cracked geometry. For a unit crack-plane normal n, compute σ = nᵀSn and add the specified residual normal stress:

`KI = Y max(0, σ + σresidual) √(π a)`

Convert a from mm to m. The UI uses MPa√m for toughness; archives use Pa√m. Y and the meaning of a depend on crack geometry. For an infinite centre crack, Y=1 and a is half the total crack length. Surface cracks and finite plates require their own validated factors. Register the factor/flaw basis and assumptions that make the uncracked nominal stress representative over the flaw. See the [AFGROW DTD Handbook](https://www.afgrow.net/applications/DTDHandbook/sections/page2_2_1.aspx).

Register toughness bounds, temperature range, source, test conditions and surface state in “Brittle material fracture toughness”. Run linear structure at a temperature covered by the toughness data, then open the assessment panel and supply flaw/geometry/residual-stress bounds and the crack normal. Save the assessed result as a case to preserve and restore the input and derived fields. Changing flaw settings invalidates the displayed assessment.

Surface state records whether the test data applies; descriptive roughness or scratch text does not automatically change toughness or flaw dimensions. [NIST describes](https://nvlpubs.nist.gov/nistpubs/sp958-lide/html/181-183.html) the importance of surface flaws and environmental crack growth in glass. A material name or ordinary strength alone is insufficient.

The lower KI uses minimum a, Y and residual stress; the upper uses their maxima. Divide lower KI by maximum toughness and upper KI by minimum toughness. The model screens every tetrahedron; it does not assign a probability that an actual flaw exists there. Upper utilization below one means “below toughness”; bounds crossing one mean “uncertain”; lower utilization at least one means “reaches toughness”. These are conditional assessments, not guaranteed safety, lifetime or final fracture predictions.

Element critical flaw bounds follow `a_critical = (KIC/(Y σopening))²/π`, stored in mm. JSON `null` represents unbounded critical size at zero tensile opening. Bounds are deterministic parameter intervals, not confidence intervals or Weibull probabilities. Toughness is not interpolated with temperature.

The synthetic reference uses a 10×10×40 mm bar, E=1 GPa, ν=0 and 100 N to give 1 MPa nominal tension. It is not measured glass data. Synthetic toughness 0.02–0.03 MPa√m, a=0.1–0.4 mm, Y=1 and zero residual stress give utilization 0.59081795–1.77245385 and critical size 0.12732395–0.28647890 mm. Tests cover these references, compression closure, orientation invariance, parameter sensitivity, temperature limits, real WASM execution, archives and tamper rejection. Recomputed archive fields establish assessment consistency, not experimental validity of the FE stresses.

Only static small-strain linear elasticity and mode I are supported. Reject crack-plane shear traction above `1e-5` times the largest stress component, nonlinear materials, thermal stress and modal results. Stress corrosion, subcritical crack growth, fatigue lifetime, Weibull statistics, crack interaction/propagation and residual-stress depth profiles remain unsupported. Singular or strongly graded stresses require a separate crack analysis and measurements.

Use `evaluateFracture(result, properties, options)`, Worker `options.fractureAssessment`, or `window.analysisApi.evaluateFracture(options)` with registered `properties.fractureData`.
