// Regenerate the small synthetic bundle with actual Gmsh + independent elastic solves.
// This reference request is the same material/geometry and 0/25/50/100/50/0 N route used by the tests.
import {writeFileSync} from 'node:fs';
import {createIncrementCurveBundle} from './increment-curve-bundle-service.mjs';
import {createIncrementCurveArtifacts} from '../src/increment-curve-export.js';

const request={
 synthetic:true,
 curveId:'synthetic-bar-independent-linear-solves',
 caseIdentity:{name:'Synthetic 10x10x40 mm bar',synthetic:true},
 rowIdentity:{materialKey:'synthetic-E1e9-nu0',geometryKey:'box-10x10x40mm',gaugeKey:'weighted-end-faces'},
 boundsMm:[0,0,0,10,10,40],
 meshSizeMm:4,
 youngModulusPa:1e9,
 poissonRatio:0,
 axis:[0,0,1],
 initialGaugeLengthMm:40,
 initialAreaMm2:100,
 loadsN:[0,25,50,100,50,0]
};
const generated=await createIncrementCurveBundle(request);
const artifacts=await createIncrementCurveArtifacts(generated.bundle);
const bundle=generated.bundle,steps=bundle.steps,prefix='docs/evidence/2026-10-22-resultcurve-export';
writeFileSync(prefix+'-bundle.json',JSON.stringify(bundle)+'\n');
writeFileSync(prefix+'-proof.json',JSON.stringify({schemaVersion:1,synthetic:true,measured:false,routeN:steps.map(step=>step.controlledValue),reference:{youngModulusPa:1e9,poissonRatio:0,lengthMm:40,areaMm2:100,at100N:{extensionMm:0.04,engineeringStressPa:1e6,engineeringStrain:0.001}},inputRevision:artifacts.curve.inputRevision,meshRevision:artifacts.curve.meshRevision,curve:artifacts.curve,savedResultSubset:['kind','displacement','constraintReactions','applied','residual'],scope:'Exact vectors from real independent linear solves; unused tensors/visual/performance arrays omitted. Not a plastic history or normal Studio project bundle.'},null,2)+'\n');
console.log(JSON.stringify({bundleBytes:new TextEncoder().encode(JSON.stringify(bundle)).length,nodeCount:bundle.spec.nodeCount,steps:steps.length,peak:artifacts.curve.steps[3]}));
