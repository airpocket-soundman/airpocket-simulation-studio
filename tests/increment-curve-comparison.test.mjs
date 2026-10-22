import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {solveElastic} from '../src/fem-core.js';
import {createIncrementCurveArtifacts} from '../src/increment-curve-export.js';
import {createIncrementCurveComparison,INCREMENT_CURVE_COMPARISON_LIMITS} from '../src/increment-curve-comparison.js';

const bar=JSON.parse(readFileSync(new URL('../docs/evidence/2026-10-22-resultcurve-export-bundle.json',import.meta.url),'utf8'));
const tet=JSON.parse(readFileSync(new URL('../public/examples/increment-curve-reference.json',import.meta.url),'utf8'));
function referenceBundles(){
  const a=structuredClone(bar);a.spec.curveId='bar-A';
  const b=structuredClone(tet);b.spec.curveId='tet-B';
  // A genuinely different geometry/material: independently solve every accepted
  // step, rather than scaling A's displacements or copying a supplied curve.
  b.spec.mesh.nodes[11]=20;b.spec.initialGaugeLengthMm=20;
  b.spec.input.materialProperties.youngModulus=2e9;
  b.spec.input.sourceModel={synthetic:true,kind:'tet-reference',heightMm:20};
  b.spec.rowIdentity={materialKey:'synthetic-E2e9',geometryKey:'tet-z20',gaugeKey:'nodes0-3-z20'};
  for(const step of b.steps){
    step.rowIdentity={...b.spec.rowIdentity};
    if(step.converged)step.output={input:b.spec.input,mesh:b.spec.mesh,calculation:step.output.calculation,result:solveElastic(b.spec.mesh,{youngModulus:2e9,poissonRatio:0},{fixed:b.spec.fixedNodes,forces:[{node:3,value:[0,0,step.controlledValue]}]})};
  }
  return [a,JSON.parse(JSON.stringify(b))];
}
function parse(svg){const document=new DOMParser().parseFromString(svg,'image/svg+xml');assert.equal(document.getElementsByTagName('parsererror').length,0);return document;}
const groups=document=>[...document.getElementsByTagName('g')];

test('different actual solve geometries/materials retain verified rows and exact CSV/JSON values',async()=>{
  const bundles=referenceBundles(),before=JSON.stringify(bundles);
  const singles=await Promise.all(bundles.map(createIncrementCurveArtifacts));
  const result=await createIncrementCurveComparison({bundles});
  assert.equal(JSON.stringify(bundles),before);
  assert.deepEqual(result.comparison.curves,singles.map(item=>item.curve));
  assert.deepEqual(JSON.parse(result.json),result.comparison);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.comparison.curves));
  assert.equal(result.comparison.kind,'increment-curve-comparison');
  assert.equal(result.comparison.analysis.kind,'independent-linear-solves');
  assert.equal(result.comparison.analysis.plasticHistory,false);
  assert.deepEqual(result.comparison.units,{extensionMm:'mm',forceN:'N',engineeringStrain:'dimensionless',engineeringStressPa:'Pa'});
  assert.notEqual(result.comparison.curves[0].rowIdentity.geometryKey,result.comparison.curves[1].rowIdentity.geometryKey);
  assert.notEqual(result.comparison.curves[0].inputRevision,result.comparison.curves[1].inputRevision);
  const header=singles[0].csv.slice(0,singles[0].csv.indexOf('\r\n')+2);
  assert.equal(result.csv,header+singles.map(item=>item.csv.slice(item.csv.indexOf('\r\n')+2)).join(''));
  const peak=result.comparison.curves[0].steps[3];
  assert.ok(Math.abs(peak.extensionMm/0.04-1)<1e-6);
  assert.ok(Math.abs(peak.engineeringStressPa/1e6-1)<1e-6);
});

test('both SVG panels use exact validated fields, shared scales and separate failed-gap series',async()=>{
  const bundles=referenceBundles();
  const {output:ignored,...failed}=bundles[0].steps[2];bundles[0].steps[2]={...failed,converged:false};
  const result=await createIncrementCurveComparison({bundles}),document=parse(result.svg);
  const panels=groups(document).filter(node=>node.hasAttribute('data-panel'));
  assert.deepEqual(panels.map(panel=>panel.getAttribute('data-panel')),['force-displacement','engineering-stress-strain']);
  for(const panel of panels){
    const engineering=panel.getAttribute('data-panel')==='engineering-stress-strain';
    const curves=[...panel.getElementsByTagName('g')].filter(node=>node.hasAttribute('data-curve-index'));
    assert.equal(curves.length,2);
    for(let i=0;i<curves.length;i++){
      assert.equal(curves[i].getAttribute('data-curve-id'),result.comparison.curves[i].curveId);
      const expected=result.comparison.curves[i].steps.filter(row=>row.status==='converged');
      const points=[...curves[i].getElementsByTagName('circle')];assert.equal(points.length,expected.length);
      for(let j=0;j<points.length;j++){
        assert.equal(Number(points[j].getAttribute(engineering?'data-engineering-strain':'data-extension-mm')),expected[j][engineering?'engineeringStrain':'extensionMm']);
        assert.equal(Number(points[j].getAttribute(engineering?'data-engineering-stress-pa':'data-force-n')),expected[j][engineering?'engineeringStressPa':'tensileForceN']);
      }
      assert.deepEqual([...curves[i].getElementsByTagName('path')].map(node=>node.getAttribute('data-step-indices')),i===0?['0,1','3,4,5']:['0,1']);
    }
    const first=curves.map(curve=>curve.getElementsByTagName('circle')[0]);
    assert.equal(first[0].getAttribute('cx'),first[1].getAttribute('cx'),'zero uses the same x scale');
    assert.equal(first[0].getAttribute('cy'),first[1].getAttribute('cy'),'zero uses the same y scale');
    assert.notEqual(first[0].getAttribute('stroke'),first[1].getAttribute('stroke'));
  }
  const legends=groups(document).filter(node=>node.hasAttribute('data-legend-curve-index'));
  assert.equal(legends.length,2);assert.match(legends[0].textContent,/#1 bar-A/);assert.match(legends[1].textContent,/#2 tet-B/);
});

test('all series snapshot before awaits, including later caller mutations',async()=>{
  const bundles=referenceBundles(),expected=await createIncrementCurveComparison({bundles});
  const request={bundles},pending=createIncrementCurveComparison(request);
  bundles[1].spec.curveId='late-mutation';bundles[1].steps[3].output.result.displacement.fill(99);
  request.bundles=[];
  assert.deepEqual(await pending,expected);
});

test('2..4 exact dedicated bundles, unique IDs and aggregate byte limits are enforced',async()=>{
  const [a,b]=referenceBundles();
  for(const bundles of [[],[a],[a,b,a,b,a]])await assert.rejects(createIncrementCurveComparison({bundles}),/2\.\.4/);
  await assert.rejects(createIncrementCurveComparison({bundles:[a,a]}),/unique/);
  await assert.rejects(createIncrementCurveComparison({bundles:[a,b],comparison:{}}),/only bundles/);
  const decorated=[a,b];decorated.note='not-json-array';
  await assert.rejects(createIncrementCurveComparison({bundles:decorated}),/decorated/);
  let called=false;const accessor={};Object.defineProperty(accessor,'bundles',{enumerable:true,get(){called=true;return [a,b];}});
  await assert.rejects(createIncrementCurveComparison(accessor),/data property/);assert.equal(called,false);
  const four=Array.from({length:4},(_,index)=>{const bundle=structuredClone(tet);bundle.spec.curveId='size-'+index;bundle.spec.caseIdentity.padding=Array.from({length:9},()=>'x'.repeat(60000));return bundle;});
  await assert.rejects(createIncrementCurveComparison({bundles:four}),/2 MiB/);
  const validFour=Array.from({length:4},(_,index)=>{const bundle=structuredClone(tet);bundle.spec.curveId='four-'+index;return bundle;});
  assert.equal((await createIncrementCurveComparison({bundles:validFour})).comparison.curves.length,4);
  assert.equal(INCREMENT_CURVE_COMPARISON_LIMITS.artifactBytes,2097152);
});

test('unsafe labels remain inert and long identical prefixes have distinct numbered legends',async()=>{
  const bundles=referenceBundles();
  bundles[0].spec.curveId='=SUM(1,2)<script>alert(1)</script>';
  bundles[1].spec.curveId='@B<img src=x onerror=alert(1)>';
  const result=await createIncrementCurveComparison({bundles}),document=parse(result.svg);
  assert.equal(document.getElementsByTagName('script').length,0);assert.equal(document.getElementsByTagName('img').length,0);
  assert.ok(!result.svg.includes('href='));assert.ok(result.svg.includes('&lt;script&gt;'));
  assert.match(result.csv,/"'=SUM/);assert.match(result.csv,/"'@B/);
  bundles[0].spec.curveId='x'.repeat(99)+'a';bundles[1].spec.curveId='x'.repeat(99)+'b';
  const long=parse((await createIncrementCurveComparison({bundles})).svg);
  const legends=groups(long).filter(node=>node.hasAttribute('data-legend-curve-index'));
  assert.match(legends[0].textContent,/#1/);assert.match(legends[1].textContent,/#2/);
  assert.ok(legends[0].textContent.includes(bundles[0].spec.curveId));assert.ok(legends[1].textContent.includes(bundles[1].spec.curveId));
});

test('failed-only series are preserved without points, segments or invented values',async()=>{
  const bundles=referenceBundles();
  for(const bundle of bundles)bundle.steps=bundle.steps.map(({output,...step})=>({...step,converged:false}));
  const result=await createIncrementCurveComparison({bundles}),document=parse(result.svg);
  assert.equal(document.getElementsByTagName('circle').length,0);
  assert.equal([...document.getElementsByTagName('path')].filter(node=>node.hasAttribute('data-step-indices')).length,0);
  for(const curve of result.comparison.curves)for(const row of curve.steps)assert.equal(row.engineeringStressPa,null);
  assert.ok(!/NaN|Infinity/.test(result.svg));
});

test('comparison artifact expansion is independently bounded after valid input snapshots',async()=>{
  const bundles=Array.from({length:2},(_,index)=>{
    const bundle=structuredClone(tet);bundle.spec.curveId='expanded-'+index;
    bundle.spec.caseIdentity.padding=Array.from({length:100000},()=>'a');return bundle;
  });
  assert.ok(new TextEncoder().encode(JSON.stringify({bundles})).length<INCREMENT_CURVE_COMPARISON_LIMITS.inputBytes);
  for(const bundle of bundles)await createIncrementCurveArtifacts(bundle);
  await assert.rejects(createIncrementCurveComparison({bundles}),/Comparison artifact exceeds 2 MiB/);
});
