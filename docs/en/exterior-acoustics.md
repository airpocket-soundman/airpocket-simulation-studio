# Exterior radiation and far-field directivity

[日本語](../exterior-acoustics.md)

Use the Spherical source / exterior radiation example. For STEP or built-in solids, create a surrounding spherical acoustic domain, expose source faces with section view and prescribe pressure. Radius derives from display bounds plus padding, and meshing checks containment of the actual CAD bounds. OCC subtracts the original solid from the sphere; sealed internal cavities are excluded from the exterior domain.

The outer sphere automatically uses a first-order radiation condition. With exp(+iωt) time convention, outgoing waves are exp(−ikr)/r. Bulk loss uses k_c²=k²(1−iη). The boundary condition ∂p/∂n=−(ik_c+1/R)p adds a boundary mass coefficient (ik_c+1/R)/ρ. Overlapping outer pressure/impedance and incomplete spherical boundaries are rejected.

Theory reference: [spherical radiation boundary](https://doc.comsol.com/6.4/doc/com.comsol.help.comsol/comsol_ref_acoustics.27.20.html). This is Airpocket’s first-order approximation, not a port of COMSOL’s higher-order conditions or solver. PML, BEM and exact nonreflecting conditions for all modes are unsupported.

Far fields use the Kirchhoff–Helmholtz asymptotic integral of outer-surface pressure and normal derivative. For direction d, F(d)=1/(4π) ∫[ik_c(n·d)p−q]exp(ik_c d·y)dS, where q=∂p/∂n and y is relative to the sphere center. Multiply by exp(−ik_c r)/r to scale to the reference distance. Boundary triangles use seven-point integration. A reference distance in the near field still reports an asymptotic scaled value, not actual near-field pressure; use the 3D probe for in-domain pressure. [Exterior integral theory](https://doc.comsol.com/6.4/doc/com.comsol.help.aco/aco_ug_pressure.05.172.html)

Choose XY/YZ/ZX planes, 12–180 directions and reference distance. Angles follow the right-hand rule about the selected positive axis. Outputs include peak mPa, RMS SPL and relative level normalized to the maximum. The polar chart spans 0 to −60 dB; zero pressure has undefined relative directivity. Cases retain radiated power, directional complex pressures and chart data.

Reference: 5 mm source radius, 1 Pa pressure, 20 mm enclosure, 1000 Hz, density 1.2 kg/m³, speed 343 m/s and zero loss. The solution p(r)=a/r exp[−ik(r−a)] gives 5 mPa at 1 m and power 2πa²/(ρc)=3.8163e−7 W. Pressure error decreases from about 6.3% with 4 mm elements to 2.5% with 2 mm; the UI reports 5.1248 mPa. Tests also compare 20/30 mm enclosures, translated coordinates, doubled amplitude/quadrupled power and an l=1 angular trace.

Both target size and actual longest edge must resolve the wavelength with at least six subdivisions. General shapes retain finite-boundary approximation error: compare enclosure sizes and mesh refinement. Structural vibration excitation, heterogeneous media, viscous/thermal boundary layers, transient propagation and listening remain separate tasks.

Gmsh-derived display surfaces retain a SHA-256 identity of original CAD/primitive parameters and CAD face tags. Complete unchanged faces survive remeshing through tag correspondence with display-geometry checks. Changed source geometry requires reselection. Partial regions still use triangle projection; exact dimensional patches remain REG2 work.

Verification: tests/acoustic-radiation.test.mjs, tests/source-identity.test.mjs and tests/worker-pipeline.test.mjs. `npm run test:published` also exercises deployed exterior acoustics.
