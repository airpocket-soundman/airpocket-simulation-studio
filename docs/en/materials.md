# Material models

[日本語](../materials.md)

Separate category, constitutive law, measured properties and failure criterion. Missing-value templates must not run as though they contain real material data. The current editor stores properties for the model as a whole; per-part assignment is still planned.

|Category|Initial treatment|Later requirements and evaluation|
|---|---|---|
|Metal|Linear elasticity: modulus, Poisson ratio, density; record strength definition|Stress-strain curves, plasticity, temperature dependence and fatigue; appropriate ductile yield criteria|
|Polymer|Linear elasticity within a stated range|Temperature/rate dependence, viscoelasticity, creep, plasticity and molding/print anisotropy; test-specific strength criteria|
|Glass|Elastic displacement and principal stress|Defects, surface state, fracture toughness and statistical strength; do not apply metal yield rules|
|Rubber|Category available; practical large-deformation analysis is later|Hyperelastic parameters, compressibility and tension/compression test curves; appropriate elements and large-deformation solution, not hardness-only fracture prediction|
|Fluid|Single-phase Newtonian baseline|Density, viscosity, temperature dependence and model-specific flow conditions|

Thermal data includes conductivity, specific heat, density, expansion coefficient and, when necessary, emissivity. Thermal stress also needs a reference temperature. Store grade, source, units, valid temperatures, strain rate, orientation, test conditions and calibration history. Preserve uncertainty and the experimentally validated range for fracture predictions.

API material properties use SI for modulus/strength (Pa); the UI displays MPa. Density is kg/m³, conductivity W/(m·K), specific heat J/(kg·K), expansion 1/K, temperature limits °C. Null means missing. For linear isotropic elasticity, -1 < Poisson ratio < 0.5; incompressible rubber needs a different validated formulation.

Compressible Neo-Hookean finite-strain CPU analysis is supported within the limits documented in [hyperelasticity](hyperelasticity.md). Near-incompressibility and viscoelasticity remain unsupported.
