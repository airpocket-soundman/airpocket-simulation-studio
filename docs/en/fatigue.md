# S–N fatigue evaluation for proportional uniaxial loading

[日本語](../fatigue.md)

This limited model scales a linear-elastic uniaxial stress result between minimum and maximum load factors for constant-amplitude proportional loading. It requires measured S–N data, ultimate tensile strength, yield stress, test conditions and provenance. A material name or tensile strength alone does not generate fatigue life. No numeric life is shown without fatigue data.

Register material `fatigueData` in this form. These synthetic values are verification fixtures and must not be used as design data for a real material.

```js
{
  model: 'stress-life',
  stressRatio: -1,
  snCurve: [
    {stressAmplitudePa: 200e6, cycles: 1e4},
    {stressAmplitudePa: 100e6, cycles: 1e6}
  ],
  ultimateStrengthPa: 600e6,
  yieldStressPa: 300e6,
  source: 'Synthetic verification fixture; not a material grade',
  testConditions: 'Synthetic fully reversed R=-1 stress-amplitude data; tensile-mean Goodman permitted for this reference only'
}
```

Stresses are in Pa and life is in cycles. The reference curve must specify fully reversed `stressRatio:-1`. Supply 2–100 points in strictly decreasing stress-amplitude and strictly increasing cycle order. Stress range is twice the amplitude. Ultimate strength must exceed positive yield stress. Source and test conditions must be nonempty strings. Record temperature, surface condition, stress ratio, specimen geometry, statistical interpretation and the basis for applying mean-stress correction.

Use signed uniaxial extrema to obtain `σa=(σmax−σmin)/2` and `σm=(σmax+σmin)/2`. Tensile mean stress alone receives Goodman correction: `σa,eq=σa/(1−max(σm,0)/σu)`. Compressive mean stress receives no life benefit. Absolute peak stress above yield rejects an elastic S–N evaluation.

Interpolate log stress amplitude against log cycles only between registered data points. Do not extrapolate outside the measured range or infer infinite life below it. Given n applied cycles, usage is `D=n/N`, a single constant-amplitude Miner evaluation without load-sequence or crack-growth tracking.

Multiaxial/nonproportional loading, plastic fatigue, variable-amplitude rainflow counting, crack growth, automatic surface/size corrections and certified fatigue life are unsupported. Stress singularities and coarse-mesh peaks cannot establish component life.

Primary references: [Altair's official uniaxial S–N approach and experimental log-segment curves](https://www.help.altair.com/2021/hwsolvers/os/topics/solvers/os/analysis_fatigue_uniaxial_r.htm), [COMSOL's mean-stress correction](https://doc.comsol.com/6.3/doc/com.comsol.help.fatigue/fatigue_ug_sme.4.28.html), and [COMSOL's cumulative damage model](https://doc.comsol.com/6.4/doc/com.comsol.help.fatigue/fatigue_ug_sme.4.09.html). This implementation is not a port of those product solvers.
