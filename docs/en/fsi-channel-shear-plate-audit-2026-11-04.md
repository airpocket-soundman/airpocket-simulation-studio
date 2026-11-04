# COUPLE5 tangential shear-wall independent audit

[日本語](../fsi-channel-shear-plate-audit-2026-11-04.md)

Audited work-order102 at base d8214ad and changed only its coupling layer. [Dated evidence](../evidence/2026-11-04-couple5-independent-audit.json) is synthetic/provisional/uncalibrated. Fluid solver,76/85modules,worker/MCP/UI andprogress remain unchanged; generalFSI acceptance remains open.

Both ends of each dissipation trapezoid now use the **current held wall velocity V**, replacing the erroneous zero/previous-step velocity at the left endpoint. An independent two-step face-jump quadrature detects the bug. Zero-energy equilibrium produces finite zero relative/absolute defects, rather than NaN/JSONnull. Added energyDefectJPerM2; positive initial energy underflow refuses. Unknown state/structure options can no longer replace internal Newmark state.

SI units: height/displacement m, velocity m/s,density kg/m³,kinematic viscosity m²/s,plate mass kg/m²,spring N/m³,interface force Pa,mechanical/cumulative-dissipation energy J/m²,dissipation rate W/m². Independent six-state finite-volume matrix exponential (scaled Taylor, not RK4) verifies nonzero initial fluid profiles and reference-step halving. Cell-force sums match bottom-wall/spring momentum balance; energy derivatives match face-jump dissipation.

The structural scheme uses[Newmark beta1/4,gamma1/2](https://mooseframework.inl.gov/source/timeintegrators/NewmarkBeta.html). Its average velocity satisfies(dNew−dOld)/dt=(vNew+vOld)/2, so average linear wall shear is compatible with structural work. This does not establish unconditional stability of the partitioned fluid coupling. The old102interpretation of an unavoidable first-order energy defect included the left-end evaluation bug. At dt.004/.002/.001, maximum relative energy defects change from.072886/.030157/.014644 to.023608/.005605/.000738; displacement trajectories/iterations remain unchanged. Cancellation of finite-step errors prevents treating observed ratios as a general order or exact-energy-conservation theorem. [Historical102evidence](../evidence/2026-10-29-opencode-102-couple5.json) is preserved.

converged:true means interface fixed-point convergence only, not time/grid/physical accuracy. Failed marches retain partial history/failedStep without a completed profile. The reference now accepts the same initial profile and rejects invalid h/time/work. actualDt*(4ν/hy²+4μ/(m*hy)+sqrt(k/m))<=.1 is a conservative local precondition, not a general stability theorem.

Bounds: power-of-two cellsX4..256,cellsY4..512,coupledsteps<=20000,iterations<=200,fluid substeps<=20000; preflight requires steps*(maxIterations+1)*substeps*cellsX*cellsY<=20000000. RK4steps<=500000 and steps*(cellsY+2)<=10000000. Nonfinite derived geometry/viscosity/steps/state/outputs refuse.

Save fluid.parameters with plate/initial-profile array/dt/steps, then recreate the issued fluid with channelShearFluid(parameters). Snapshots are frozen; serialized executable methods or intermediate-state restoration are unsupported. JSON input replay equality and unchanged failed inputs are covered. Public types distinguish successful and partial results.

Related40tests and36contract declarations pass. Normal walls/ALE,pressure coupling,curved work-conserving transfer,IQN-ILS,nonlinearity,measurements and product integration remain unverified. No newSU2run.
