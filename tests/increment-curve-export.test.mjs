import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {solveElastic} from '../src/fem-core.js';
import {loadedFaceTractionForces} from '../src/increment-curve-data.js';
import {createIncrementCurveArtifacts,INCREMENT_CURVE_EXPORT_LIMITS} from '../src/increment-curve-export.js';

const fixture=JSON.parse(readFileSync(new URL('../docs/evidence/2026-10-22-resultcurve-export-bundle.json',import.meta.url),'utf8'));
const proof=JSON.parse(readFileSync(new URL('../docs/evidence/2026-10-22-resultcurve-export-proof.json',import.meta.url),'utf8'));
const clone=()=>structuredClone(fixture);
function parseCsv(csv){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<csv.length;i++){
    const ch=csv[i];
    if(ch==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if(ch==='\r'&&!quoted&&csv[i+1]==='\n'){row.push(cell);rows.push(row);row=[];cell='';i++;}
    else cell+=ch;
  }
  assert.equal(quoted,false);assert.equal(cell,'');return rows;
}
function parseSvg(svg){
  const document=new DOMParser().parseFromString(svg,'image/svg+xml');
  assert.equal(document.documentElement.nodeName,'svg');
  assert.equal(document.getElementsByTagName('parsererror').length,0);
  return document;
}

test('real solver subset roundtrips to the reference and consistent CSV/JSON/SVG',async()=>{
  const bundle=clone(),before=JSON.stringify(bundle);
  const result=await createIncrementCurveArtifacts(bundle);
  assert.equal(JSON.stringify(bundle),before);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.curve.steps));
  assert.deepEqual(result.curve,proof.curve);
  assert.deepEqual(JSON.parse(result.json),result.curve);
  const peak=result.curve.steps[3];
  assert.ok(Math.abs(peak.extensionMm/0.04-1)<1e-6);
  assert.ok(Math.abs(peak.engineeringStressPa/1e6-1)<1e-6);
  assert.ok(Math.abs(peak.engineeringStrain/0.001-1)<1e-6);
  // Independently solve the saved mesh again: saved displacement/reactions are
  // actual solver vectors, rather than a curve fabricated from reference values.
  const actual=solveElastic(bundle.spec.mesh,{youngModulus:1e9,poissonRatio:0},{fixed:bundle.spec.fixedNodes,forces:loadedFaceTractionForces(bundle.spec.mesh,{spec:bundle.spec,totalForceN:100})});
  for(const key of proof.savedResultSubset)assert.deepEqual(bundle.steps[3].output.result[key],actual[key],key);
  const [headers,...rows]=parseCsv(result.csv),column=name=>headers.indexOf(name);
  const document=parseSvg(result.svg),points=[...document.getElementsByTagName('circle')];
  assert.equal(points.length,6);assert.equal(rows.length,6);
  for(let i=0;i<rows.length;i++){
    assert.equal(Number(rows[i][column('extensionMm[mm]')]),result.curve.steps[i].extensionMm);
    assert.equal(Number(rows[i][column('tensileForceN[N]')]),result.curve.steps[i].tensileForceN);
    assert.equal(Number(points[i].getAttribute('data-extension-mm')),result.curve.steps[i].extensionMm);
    assert.equal(Number(points[i].getAttribute('data-force-n')),result.curve.steps[i].tensileForceN);
    assert.equal(rows[i][column('analysisKind')],'independent-linear-solves');
    assert.equal(rows[i][column('plasticHistory')],'false');
    assert.equal(rows[i][column('resultRevision')],result.curve.steps[i].resultRevision);
  }
});

test('failed rows remain null in tables and break SVG segments',async()=>{
  const bundle=clone(),{output:discarded,...failed}=bundle.steps[2];
  bundle.steps[2]={...failed,converged:false,provisional:true};
  bundle.steps[3].provisional=true;
  const result=await createIncrementCurveArtifacts(bundle),document=parseSvg(result.svg);
  const [headers,...rows]=parseCsv(result.csv);
  assert.equal(result.curve.steps[2].extensionMm,null);
  assert.equal(rows[2][headers.indexOf('extensionMm[mm]')],'');
  assert.equal(rows[2][headers.indexOf('resultRevision')],'');
  const segments=[...document.getElementsByTagName('path')].filter(node=>node.hasAttribute('data-step-indices'));
  assert.deepEqual(segments.map(node=>node.getAttribute('data-step-indices')),['0,1','3,4,5']);
  assert.equal(document.getElementsByTagName('circle').length,5);
  assert.equal([...document.getElementsByTagName('circle')].find(node=>node.getAttribute('data-step-index')==='3').getAttribute('data-provisional'),'true');
  const allFailed={spec:bundle.spec,steps:[bundle.steps[2]]};
  assert.equal(parseSvg((await createIncrementCurveArtifacts(allFailed)).svg).getElementsByTagName('circle').length,0);
});

test('forged curves, mixed identities, changed mesh and wrong force are rejected',async()=>{
  await assert.rejects(createIncrementCurveArtifacts({...clone(),curve:proof.curve}),/only spec and steps/);
  for(const change of [
    bundle=>{bundle.steps[0].rowIdentity.materialKey='another-material';},
    bundle=>{bundle.steps[3].output.mesh.nodes[0]+=1;},
    bundle=>{bundle.steps[3].controlledValue=101;},
    bundle=>{bundle.steps[3].output.result.constraintReactions[0].force[2]+=1;}
  ]){const bundle=clone();change(bundle);await assert.rejects(createIncrementCurveArtifacts(bundle));}
});

test('XML text stays inert and string cells cannot become spreadsheet formulas',async()=>{
  const bundle=clone();bundle.spec.curveId=' <svg onload="alert(1)">&\'';
  bundle.steps[0].stepId=' \t=HYPERLINK("https://invalid")\nnext';
  bundle.steps[1].stepId='+SUM(1,1)';bundle.steps[2].stepId='@unsafe';bundle.steps[3].stepId='-text';
  const result=await createIncrementCurveArtifacts(bundle),document=parseSvg(result.svg);
  assert.equal(document.getElementsByTagName('svg').length,1);
  assert.equal(document.getElementsByTagName('script').length,0);
  assert.equal(document.getElementsByTagName('image').length,0);
  assert.ok(!result.svg.includes('href=')&&!result.svg.includes('<svg onload='));
  assert.match(document.getElementById('curve-title').textContent,/<svg onload="alert\(1\)">/);
  const [headers,...rows]=parseCsv(result.csv),id=headers.indexOf('stepId');
  for(let i=0;i<4;i++)assert.equal(rows[i][id],"'"+bundle.steps[i].stepId);
});

test('bounded JSON validation rejects non-finite, accessors, cycles, depth and oversized input',async()=>{
  const invalid=clone();invalid.spec.input.number=Infinity;
  await assert.rejects(createIncrementCurveArtifacts(invalid),/finite/);
  let accessed=false;const accessor={steps:fixture.steps};Object.defineProperty(accessor,'spec',{enumerable:true,get(){accessed=true;return fixture.spec;}});
  await assert.rejects(createIncrementCurveArtifacts(accessor),/accessors/);assert.equal(accessed,false);
  const cycle=clone();cycle.spec.caseIdentity.self=cycle;
  await assert.rejects(createIncrementCurveArtifacts(cycle),/cyclic/);
  const deep=clone();let value=deep.spec.caseIdentity;for(let i=0;i<40;i++)value=value.next={};
  await assert.rejects(createIncrementCurveArtifacts(deep),/depth/);
  const many=clone();many.steps=Array.from({length:129},()=>({}));
  await assert.rejects(createIncrementCurveArtifacts(many),/128/);
  const huge=clone();huge.spec.caseIdentity.padding=Array.from({length:20},()=>'x'.repeat(60000));
  await assert.rejects(createIncrementCurveArtifacts(huge),/1 MiB/);
  const badText=clone();badText.spec.curveId='bad\u0000text';
  await assert.rejects(createIncrementCurveArtifacts(badText),/XML/);
  assert.equal(INCREMENT_CURVE_EXPORT_LIMITS.bundleBytes,1048576);
});

test('snapshot isolates mutations made after asynchronous export starts',async()=>{
  const bundle=clone(),started=createIncrementCurveArtifacts(bundle);
  bundle.spec.curveId='mutated';bundle.steps[3].output.result.displacement.fill(0);
  assert.deepEqual((await started).curve,proof.curve);
});

test('JSON interchange normalises negative zero without changing the input',async()=>{
  const bundle=clone();bundle.steps[0].controlledValue=-0;bundle.steps[0].output.calculation.controlledValue=-0;
  const result=await createIncrementCurveArtifacts(bundle);
  assert.ok(Object.is(bundle.steps[0].controlledValue,-0));
  assert.deepEqual(JSON.parse(result.json),result.curve);
  assert.ok(Object.is(result.curve.steps[0].controlledValue,0));
});

test('finite extreme values never produce Infinity/NaN SVG coordinates',async()=>{
  // Adversarial contract-shaped inputs for rendering bounds, not physics evidence.
  const spec={schemaVersion:1,curveId:'finite-rendering-bounds',caseIdentity:{synthetic:true},rowIdentity:{materialKey:'m',geometryKey:'g',gaugeKey:'q'},input:{synthetic:true},mesh:{nodes:[0,0,0,0,0,40]},nodeCount:2,axis:[0,0,1],initialGaugeLengthMm:40,initialAreaMm2:100,fixedNodes:[0],loadedNodes:[1],gauge:{a:{nodes:[0],weights:[1]},b:{nodes:[1],weights:[1]}}};
  const steps=[-1,1].map((sign,index)=>({stepId:`bounds-${index}`,controlledQuantity:'force',controlledValue:sign*100,converged:true,provisional:true,rowIdentity:spec.rowIdentity,output:{input:spec.input,mesh:spec.mesh,calculation:{controlledQuantity:'force',controlledValue:sign*100,controlledUnit:'N',plasticHistory:false},result:{kind:'elastic',displacement:[0,0,0,0,0,sign*1e308],constraintReactions:[{node:0,force:[0,0,-sign*100]}],applied:[0,0,sign*100]}}}));
  const result=await createIncrementCurveArtifacts({spec,steps});
  assert.ok(!/NaN|Infinity/.test(result.svg));
  const [headers,...rows]=parseCsv(result.csv);
  assert.equal(rows[0][headers.indexOf('tensileForceN[N]')],'-100');
  for(const point of parseSvg(result.svg).getElementsByTagName('circle'))for(const key of ['cx','cy'])assert.ok(Number.isFinite(Number(point.getAttribute(key))));
});
