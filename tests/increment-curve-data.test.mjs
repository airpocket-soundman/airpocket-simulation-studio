import {test} from 'node:test';
import assert from 'node:assert/strict';
import initialize from '@loumalouomega/gmsh-wasm';
import {generateMesh} from '../src/mesh-core.js';
import {solveElastic} from '../src/fem-core.js';
import {
  INCREMENT_CURVE_SCHEMA_VERSION,
  buildIncrementCurve,
  extractIncrementMeasurement,
  loadedFaceTractionForces,
  validateIncrementSpec
} from '../src/increment-curve-data.js';

// Synthetic reference: the same 10x10x40 mm axial bar, E=1e9 Pa, nu=0, A=100 mm^2, L=40 mm that
// tests/elastic.test.mjs uses. Nothing here is a measured specimen or a plastic load history.
const reference={bounds:[0,0,0,10,10,40],size:4,youngModulus:1e9,poissonRatio:0,areaMm2:100,gaugeLengthMm:40};
const route=[0,25,50,100,50,0];
const relError=(actual,expected)=>Math.abs(actual/expected-1);

let modelPromise=null,curvePromise=null;
async function referenceModel(){
  if(modelPromise)return modelPromise;
  modelPromise=(async()=>{
    const mesh=await generateMesh(initialize,{kind:'box',bounds:reference.bounds},{size:reference.size}),nodeCount=mesh.nodes.length/3;
    const fixedNodes=[],loadedNodes=[];
    for(let node=0;node<nodeCount;node++){const z=mesh.nodes[3*node+2];if(Math.abs(z)<1e-7)fixedNodes.push(node);else if(Math.abs(z-40)<1e-7)loadedNodes.push(node);}
    if(!fixedNodes.length||!loadedNodes.length)throw Error('Synthetic reference mesh has no end faces');
    const equalWeights=nodes=>nodes.map(()=>1/nodes.length);
    const spec={
      schemaVersion:INCREMENT_CURVE_SCHEMA_VERSION,
      curveId:'synthetic-uniform-bar-independent-linear-solves',
      caseIdentity:{name:'synthetic uniform bar 10x10x40 mm',synthetic:true},
      rowIdentity:{materialKey:'synthetic-linear-elastic-E1e9-nu0',geometryKey:'synthetic-box-10x10x40',gaugeKey:'synthetic-end-faces'},
      input:{synthetic:true,note:'synthetic reference input for the RESULTCURVE1 unit tests',study:{kind:'structural'},materialProperties:{youngModulus:reference.youngModulus,poissonRatio:reference.poissonRatio},sourceModel:{kind:'box',bounds:reference.bounds},meshSize:reference.size},
      mesh,
      axis:[0,0,1],
      nodeCount,
      initialGaugeLengthMm:reference.gaugeLengthMm,
      initialAreaMm2:reference.areaMm2,
      fixedNodes,
      loadedNodes,
      gauge:{a:{nodes:fixedNodes.slice(),weights:equalWeights(fixedNodes)},b:{nodes:loadedNodes.slice(),weights:equalWeights(loadedNodes)}}
    };
    return {mesh,nodeCount,fixedNodes,loadedNodes,spec};
  })();
  return modelPromise;
}
function solveAt(model,forceN){
  const forces=loadedFaceTractionForces(model.mesh,{spec:model.spec,totalForceN:forceN});
  return solveElastic(model.mesh,{youngModulus:reference.youngModulus,poissonRatio:reference.poissonRatio},{fixed:model.fixedNodes,forces});
}
function calculation(forceN){return {kind:'synthetic-independent-linear-elastic-solve',controlledQuantity:'force',controlledValue:forceN,controlledUnit:'N',plasticHistory:false};}
function output(model,result,forceN){return {input:model.spec.input,mesh:model.mesh,calculation:calculation(forceN),result};}
function step(model,result,forceN,index=0){return {stepId:'F'+String(forceN)+'N-step'+String(index),controlledQuantity:'force',controlledValue:forceN,converged:true,provisional:false,rowIdentity:{...model.spec.rowIdentity},output:output(model,result,forceN)};}
function referenceCurve(){
  if(curvePromise)return curvePromise;
  curvePromise=(async()=>{
    const model=await referenceModel(),results=route.map(forceN=>solveAt(model,forceN));
    return {model,results,route,curve:await buildIncrementCurve({spec:model.spec,steps:results.map((result,index)=>step(model,result,route[index],index))})};
  })();
  return curvePromise;
}

test('independent linear solves reproduce the analytical uniform-bar reference',async()=>{
  const {curve}=await referenceCurve();
  assert.equal(curve.steps.length,6);
  for(const row of curve.steps){assert.equal(row.status,'converged');assert.equal(row.converged,true);assert.equal(row.provisional,false);assert.ok(Math.abs(row.forceBalanceErrorNAxialN)<=1e-5,'axial force balance');}
  const peak=curve.steps[3];
  assert.ok(relError(peak.extensionMm,0.04)<=1e-6,'extension at 100 N');
  assert.ok(relError(peak.engineeringStressPa,1e6)<=1e-6,'engineering stress at 100 N');
  assert.ok(relError(peak.engineeringStrain,0.001)<=1e-6,'engineering strain at 100 N');
  assert.ok(relError(peak.tensileForceN,100)<=1e-6,'tensile force at 100 N');
  assert.ok(Math.abs(peak.reactionAxisN+100)<=1e-5,'support reaction at 100 N');
  assert.ok(peak.reactionAxisN<0&&peak.tensileForceN>0,'tension sign convention');
  for(const index of [2,4]){assert.equal(curve.steps[index].controlledValue,50);assert.ok(relError(curve.steps[index].extensionMm,0.02)<=1e-6,'returning 50 N on the same route');}
  assert.equal(curve.steps[2].extensionMm,curve.steps[4].extensionMm,'repeated 50 N solve is deterministic');
  for(const index of [0,5])assert.ok(Math.abs(curve.steps[index].extensionMm)<=1e-12,'zero force has zero extension');
});

test('the step table is versioned, revisioned, unit-labelled and marked as independent solves',async()=>{
  const {curve}=await referenceCurve();
  assert.equal(curve.schemaVersion,1);
  assert.match(curve.inputRevision,/^sha256:[0-9a-f]{64}$/);
  assert.match(curve.meshRevision,/^sha256:[0-9a-f]{64}$/);
  for(const row of curve.steps){
    for(const key of ['inputRevision','meshRevision','calculationRevision','resultRevision'])assert.match(row[key],/^sha256:[0-9a-f]{64}$/,key);
    assert.equal(row.inputRevision,curve.inputRevision);
    assert.equal(row.meshRevision,curve.meshRevision);
    assert.equal(row.controlledUnit,'N');
  }
  assert.equal(curve.analysis.kind,'independent-linear-solves');
  assert.equal(curve.analysis.plasticHistory,false);
  assert.equal(curve.tolerances.controlledForceAbsoluteN,1e-5);
  assert.equal(curve.tolerances.forceBalanceAbsoluteN,1e-5);
  assert.equal(curve.units.engineeringStressPa,'Pa');
  assert.equal(curve.units.engineeringStrain,'dimensionless');
  assert.equal(curve.units.forceN,'N');
  assert.equal(curve.units.lengthMm,'mm');
  assert.equal(curve.initialAreaMm2,100);
  assert.equal(curve.initialGaugeLengthMm,40);
  const label=JSON.stringify(curve);
  for(const forbidden of ['"plasticStrain"','"equivalentPlasticStrain"','"trueStressPa"','"trueStrain"','"maxVonMisesPa"','"maxDisplacementMm"','"modes"'])assert.ok(!label.includes(forbidden),'table must not expose '+forbidden);
  for(const row of curve.steps)for(const key of ['plasticStrain','trueStressPa','trueStrain'])assert.ok(!Object.hasOwn(row,key));
});

test('the table is frozen, JSON-roundtrips and never mutates its input',async()=>{
  const {model,curve}=await referenceCurve();
  const before=JSON.stringify(model.spec);
  assert.ok(Object.isFrozen(curve)&&Object.isFrozen(curve.steps)&&Object.isFrozen(curve.steps[0])&&Object.isFrozen(curve.gauge.a.weights));
  assert.throws(()=>{curve.steps[3].extensionMm=1;});
  assert.throws(()=>{curve.steps.push({});});
  assert.deepEqual(JSON.parse(JSON.stringify(curve)),curve);
  const rebuilt=await buildIncrementCurve({spec:model.spec,steps:[step(model,await solveAt(model,100),100)]});
  assert.equal(rebuilt.steps.length,1);
  assert.equal(JSON.stringify(model.spec),before,'the input spec must not be mutated');
  assert.notEqual(rebuilt.gauge,model.spec.gauge);
  assert.deepEqual(rebuilt.gauge,model.spec.gauge);
});

test('a failed step records only its state and is never interpolated into later rows',async()=>{
  const {model,results}=await referenceCurve();
  const steps=[
    step(model,results[1],25,0),
    {stepId:'F50N-step1',controlledQuantity:'force',controlledValue:50,converged:false,provisional:true,rowIdentity:{...model.spec.rowIdentity}},
    step(model,results[3],100,2)
  ];
  const curve=await buildIncrementCurve({spec:model.spec,steps});
  assert.deepEqual(curve.steps.map(row=>row.stepIndex),[0,1,2]);
  const failed=curve.steps[1];
  assert.equal(failed.status,'failed');assert.equal(failed.converged,false);assert.equal(failed.provisional,true);
  for(const key of ['inputRevision','meshRevision','calculationRevision','resultRevision','reactionAxisN','tensileForceN','appliedAxisN','forceBalanceErrorNAxialN','extensionMm','engineeringStressPa','engineeringStrain'])assert.equal(failed[key],null,key+' must be null for a failed step');
  assert.ok(relError(curve.steps[0].extensionMm,0.01)<=1e-6);
  assert.ok(relError(curve.steps[2].extensionMm,0.04)<=1e-6);
});

test('unsupported geometries, weights, axis and node lists are rejected',async()=>{
  const model=await referenceModel();
  const invalid=spec=>({...structuredClone(model.spec),...spec});
  assert.throws(()=>validateIncrementSpec(invalid({initialAreaMm2:0})),/initialAreaMm2/);
  assert.throws(()=>validateIncrementSpec(invalid({initialAreaMm2:-1})),/initialAreaMm2/);
  assert.throws(()=>validateIncrementSpec(invalid({initialGaugeLengthMm:0})),/initialGaugeLengthMm/);
  assert.throws(()=>validateIncrementSpec(invalid({initialGaugeLengthMm:20})),/Gauge initial length/);
  assert.throws(()=>validateIncrementSpec(invalid({axis:[0,0,2]})),/unit vector/);
  assert.throws(()=>validateIncrementSpec(invalid({axis:[1,0,0]})),/Gauge initial length/);
  assert.throws(()=>validateIncrementSpec(invalid({axis:[0,0,-1]})),/Gauge initial length/);
  assert.throws(()=>validateIncrementSpec(invalid({axis:[0,0,Number.NaN]})),/finite/);
  assert.throws(()=>validateIncrementSpec(invalid({nodeCount:0})),/nodeCount/);
  assert.throws(()=>validateIncrementSpec(invalid({mesh:undefined})),/spec.mesh/);
  assert.throws(()=>validateIncrementSpec(invalid({mesh:{nodes:model.mesh.nodes.slice(0,3)}})),/spec.mesh/);
  assert.throws(()=>validateIncrementSpec(invalid({fixedNodes:[...model.spec.fixedNodes,model.spec.fixedNodes[0]]})),/duplicated/);
  assert.throws(()=>validateIncrementSpec(invalid({loadedNodes:[model.spec.nodeCount]})),/in-range/);
  assert.throws(()=>validateIncrementSpec(invalid({loadedNodes:[model.spec.fixedNodes[0]]})),/cannot also be a fixed node/);
  const good=structuredClone(model.spec.gauge),first=model.spec.fixedNodes[0];
  assert.throws(()=>validateIncrementSpec(invalid({gauge:{a:{nodes:[first],weights:[0.9]},b:good.b}})),/weights must sum to 1/);
  assert.throws(()=>validateIncrementSpec(invalid({gauge:{a:good.a,b:{nodes:[good.b.nodes[0]],weights:[]}}})),/one weight per listed node/);
  assert.throws(()=>validateIncrementSpec(invalid({gauge:{a:{nodes:[first,first],weights:[0.5,0.5]},b:good.b}})),/duplicated node/);
  assert.throws(()=>validateIncrementSpec(invalid({gauge:{a:good.a,b:{nodes:[good.b.nodes[0],first],weights:[0.5,0.5]}}})),/must not share a node/);
  assert.throws(()=>validateIncrementSpec(invalid({rowIdentity:{materialKey:'a',geometryKey:'b'}})),/rowIdentity/);
  assert.throws(()=>validateIncrementSpec(invalid({input:undefined})),/input revision/);
  assert.throws(()=>validateIncrementSpec(invalid({schemaVersion:2})),/schema version/);
});

test('unsupported or inconsistent step rows are rejected',async()=>{
  const {model,results}=await referenceCurve();
  const base=step(model,results[3],100);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[]}),/at least one step/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[base,{...base}]}),/Duplicated step id/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'x',output:undefined}]}),/requires its output/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'x',output:{...base.output,result:undefined}}]}),/requires its result/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'x',output:{...base.output,input:undefined}}]}),/output input/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'x',output:{...base.output,mesh:undefined}}]}),/output mesh/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'x',output:{...base.output,calculation:undefined}}]}),/output calculation/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'x',converged:'yes'}]}),/converged flag/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'x',provisional:undefined}]}),/provisional flag/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'x',controlledQuantity:'pressure'}]}),/controlledQuantity/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'x',controlledValue:Number.NaN}]}),/controlledValue/);
  for(const key of ['materialKey','geometryKey','gaugeKey']){
    const mixed={...base,stepId:'mixed-'+key,rowIdentity:{...base.rowIdentity,[key]:'different'}};
    await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[base,mixed]}),/mixes a different material, geometry or gauge/);
  }
  const unbalanced=structuredClone(results[3]);unbalanced.applied=[0,0,0];
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'unbalanced',output:{...base.output,result:unbalanced}}]}),/does not balance/);
  const misplacedCalculation={...base.output.calculation,controlledValue:99};
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'calculation',output:{...base.output,calculation:misplacedCalculation}}]}),/calculation controlledValue/);
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'plastic',output:{...base.output,calculation:{...base.output.calculation,plasticHistory:true}}}]}),/plasticHistory:false/);
});

test('force control must match applied force and unverified displacement relabeling is refused',async()=>{
  const {model,results}=await referenceCurve();
  const base=step(model,results[3],100);
  assert.equal(base.output.result.applied[2],100);
  const claimed999={...base,stepId:'claimed-999N',controlledValue:999,output:{...base.output,calculation:{...base.output.calculation,controlledValue:999}}};
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[claimed999]}),/applied axial force/);
  const wrongSign={...base,stepId:'declared-minus-100N',controlledValue:-100,output:{...base.output,calculation:{...base.output.calculation,controlledValue:-100}}};
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[wrongSign]}),/applied axial force/);
  const displaced={...base,stepId:'prescribed-0.04mm',controlledQuantity:'displacement',controlledValue:0.04,output:{...base.output,calculation:{...base.output.calculation,controlledQuantity:'displacement',controlledValue:0.04,controlledUnit:'mm'}}};
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[displaced]}),error=>{
    assert.match(error.message,/Displacement control requires an explicit/);
    assert.ok(!error.message.includes('controlledUnit=mm'),'no successful mm control label');
    return true;
  });
});

test('mixed material, reordered mesh and caller-supplied revision strings are refused or ignored',async()=>{
  const {model,results}=await referenceCurve();
  const base=step(model,results[3],100);
  const otherInput=structuredClone(model.spec.input);
  otherInput.materialProperties.youngModulus=2e9;
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'E2e9',output:{...base.output,input:otherInput}}]}),/output input differs/);
  const reorderedMesh=structuredClone(model.mesh);
  for(let k=0;k<3;k++){const first=reorderedMesh.nodes[k];reorderedMesh.nodes[k]=reorderedMesh.nodes[3+k];reorderedMesh.nodes[3+k]=first;}
  await assert.rejects(buildIncrementCurve({spec:model.spec,steps:[{...base,stepId:'reordered',output:{...base.output,mesh:reorderedMesh}}]}),/output mesh differs/);
  const fake='sha256:'+'0'.repeat(64);
  const spoofed={...base,stepId:'spoofed',inputRevision:fake,meshRevision:fake,calculationRevision:fake,resultRevision:fake,output:{...base.output,inputRevision:fake,meshRevision:fake,calculationRevision:fake,resultRevision:fake}};
  const curve=await buildIncrementCurve({spec:model.spec,steps:[spoofed]});
  for(const key of ['inputRevision','meshRevision','calculationRevision','resultRevision'])assert.notEqual(curve.steps[0][key],fake,key+' must be derived from content');
  assert.equal(curve.steps[0].inputRevision,curve.inputRevision);
  assert.equal(curve.steps[0].meshRevision,curve.meshRevision);
});

test('modal, plasticity-history and maximum-only results are refused instead of becoming a gauge curve',async()=>{
  const {model,results}=await referenceCurve();
  const real=results[3];
  const extract=result=>extractIncrementMeasurement({spec:model.spec,result});
  assert.throws(()=>extract({...real,kind:'modal',modes:[{frequencyHz:1}]}),/linear elastic result/);
  assert.throws(()=>extract({...real,plasticity:{history:[{step:1,loadFraction:1}],plasticStrain:[[0,0,0,0,0,0]]}}),/plasticity history/);
  assert.throws(()=>extract({...real,hyperelastic:{history:[{step:1}]}}),/plasticity history/);
  assert.throws(()=>extract({kind:'elastic',maxVonMisesPa:1e6,maxDisplacementMm:0.04}),/displacement/);
  assert.throws(()=>extract({kind:'elastic',displacement:real.displacement,applied:real.applied}),/constraint reactions/);
  const noReaction=structuredClone(real);noReaction.constraintReactions=[];
  assert.throws(()=>extract(noReaction),/has no constraint reaction/);
  const nonFinite=structuredClone(real);nonFinite.displacement[model.loadedNodes[0]*3+2]=Number.NaN;
  assert.throws(()=>extract(nonFinite),/displacement/);
  const reference=extract(real),tampered=structuredClone(real);
  tampered.maxDisplacementMm=999;tampered.maxVonMisesPa=-1;tampered.magnitudes=[999];
  assert.deepEqual(extract(tampered),reference,'maximum fields must not feed the gauge data');
  tampered.displacement[model.loadedNodes[0]*3+2]+=1e-6;
  assert.notDeepEqual(extract(tampered),reference);
});

test('the result revision follows the real result content',async()=>{
  const {model,results}=await referenceCurve();
  const base=step(model,results[3],100);
  const first=await buildIncrementCurve({spec:model.spec,steps:[base]});
  const repeat=await buildIncrementCurve({spec:model.spec,steps:[{...base,output:{...base.output,result:structuredClone(results[3])}}]});
  assert.equal(first.steps[0].resultRevision,repeat.steps[0].resultRevision,'identical content hashes identically');
  const tampered=structuredClone(results[3]);tampered.displacement[model.loadedNodes[0]*3+2]+=1e-6;
  const changed=await buildIncrementCurve({spec:model.spec,steps:[{...base,output:{...base.output,result:tampered}}]});
  assert.notEqual(first.steps[0].resultRevision,changed.steps[0].resultRevision,'changed content must change the revision');
});

test('loaded-face traction distributes the requested total force along the declared axis',async()=>{
  const model=await referenceModel();
  assert.throws(()=>loadedFaceTractionForces(model.mesh,{spec:model.spec,totalForceN:Number.NaN}),/finite/);
  const forces=loadedFaceTractionForces(model.mesh,{spec:model.spec,totalForceN:100});
  assert.equal(forces.length,model.loadedNodes.length);
  const axial=forces.reduce((sum,entry)=>sum+entry.value[2],0);
  assert.ok(relError(axial,100)<=1e-9,'distributed total force');
  assert.ok(forces.every(entry=>entry.value[0]===0&&entry.value[1]===0&&entry.value[2]>0));
  assert.deepEqual(loadedFaceTractionForces(model.mesh,{spec:model.spec,totalForceN:0}).map(entry=>entry.value),model.loadedNodes.map(()=>[0,0,0]));
  const outside=structuredClone(model.spec);outside.loadedNodes=[Array.from({length:model.nodeCount},(_,node)=>node).find(node=>!outside.fixedNodes.includes(node))];
  assert.throws(()=>loadedFaceTractionForces(model.mesh,{spec:outside,totalForceN:0}),/No loaded surface triangle/);
});
