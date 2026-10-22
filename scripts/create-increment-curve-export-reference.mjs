// Regenerate the small synthetic bundle with actual Gmsh + elastic solves.
// The material/geometry and 0/25/50/100/50/0 N route match increment-curve-data.test.mjs.
import {writeFileSync} from 'node:fs';
import initialize from '@loumalouomega/gmsh-wasm';
import {generateMesh} from '../src/mesh-core.js';
import {solveElastic} from '../src/fem-core.js';
import {loadedFaceTractionForces} from '../src/increment-curve-data.js';
import {createIncrementCurveArtifacts} from '../src/increment-curve-export.js';

const mesh=await generateMesh(initialize,{kind:'box',bounds:[0,0,0,10,10,40]},{size:4});
const fixedNodes=[],loadedNodes=[];
for(let node=0;node<mesh.nodes.length/3;node++){
  if(Math.abs(mesh.nodes[node*3+2])<1e-7)fixedNodes.push(node);
  if(Math.abs(mesh.nodes[node*3+2]-40)<1e-7)loadedNodes.push(node);
}
const side=nodes=>({nodes,weights:nodes.map(()=>1/nodes.length)});
const spec={schemaVersion:1,curveId:'synthetic-bar-independent-linear-solves',caseIdentity:{name:'Synthetic 10x10x40 mm bar',synthetic:true},rowIdentity:{materialKey:'synthetic-E1e9-nu0',geometryKey:'box-10x10x40mm',gaugeKey:'weighted-end-faces'},input:{synthetic:true,study:{kind:'structural'},sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},meshSize:4,materialProperties:{youngModulus:1e9,poissonRatio:0}},mesh,nodeCount:mesh.nodes.length/3,axis:[0,0,1],initialGaugeLengthMm:40,initialAreaMm2:100,fixedNodes,loadedNodes,gauge:{a:side(fixedNodes),b:side(loadedNodes)}};
const steps=[0,25,50,100,50,0].map((force,index)=>{
  const solved=solveElastic(mesh,{youngModulus:1e9,poissonRatio:0},{fixed:fixedNodes,forces:loadedFaceTractionForces(mesh,{spec,totalForceN:force})});
  // Exact actual solver vectors/reactions, with unused tensor/visual/performance
  // arrays omitted. This saved subset is explicitly not the full solver output.
  const result={kind:solved.kind,displacement:solved.displacement,constraintReactions:solved.constraintReactions,applied:solved.applied,residual:solved.residual};
  return {stepId:`step-${index}-${force}N`,controlledQuantity:'force',controlledValue:force,converged:solved.residual<1e-8,provisional:false,rowIdentity:{...spec.rowIdentity},output:{input:spec.input,mesh,calculation:{kind:'synthetic-independent-linear-elastic-solve',controlledQuantity:'force',controlledValue:force,controlledUnit:'N',plasticHistory:false},result}};
});
// JSON is the explicit public interchange boundary. Preserve no typed-array or
// process-local references; the exporter rehashes the re-read JSON below.
const bundle=JSON.parse(JSON.stringify({spec,steps}));
const artifacts=await createIncrementCurveArtifacts(bundle);
const prefix='docs/evidence/2026-10-22-resultcurve-export';
writeFileSync(prefix+'-bundle.json',JSON.stringify(bundle)+'\n');
writeFileSync(prefix+'-proof.json',JSON.stringify({schemaVersion:1,synthetic:true,measured:false,routeN:steps.map(step=>step.controlledValue),reference:{youngModulusPa:1e9,poissonRatio:0,lengthMm:40,areaMm2:100,at100N:{extensionMm:0.04,engineeringStressPa:1e6,engineeringStrain:0.001}},inputRevision:artifacts.curve.inputRevision,meshRevision:artifacts.curve.meshRevision,curve:artifacts.curve,savedResultSubset:['kind','displacement','constraintReactions','applied','residual'],scope:'Exact vectors from real independent linear solves; unused tensors/visual/performance arrays omitted. Not a plastic history or normal Studio project bundle.'},null,2)+'\n');
console.log(JSON.stringify({bundleBytes:new TextEncoder().encode(JSON.stringify(bundle)).length,nodeCount:spec.nodeCount,steps:steps.length,peak:artifacts.curve.steps[3]}));
