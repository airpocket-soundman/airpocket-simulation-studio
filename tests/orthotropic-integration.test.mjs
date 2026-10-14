import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5,5,20);const positions=Array.from(g.attributes.position.array);g.dispose();
const face=z=>positions.flatMap((_,i)=>i%9===0&&[2,5,8].every(k=>Math.abs(positions[i+k]-z)<1e-7)?[i/9]:[]),orthotropic={model:'linear-orthotropic',youngModuliPa:[1e9,2e9,3e9],poissonRatios:[0,0,0],shearModuliPa:[4e8,5e8,6e8],axes:[[1,0,0],[0,1,0],[0,0,1]],source:'Synthetic axial bar reference; not measured printing data',testConditions:'10 x 10 x 40 mm bar, 100 N axial load, zero Poisson ratios'},project={version:1,sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind:'structural',gravityEnabled:false},materialProperties:{orthotropic},meshes:[{positions,faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))}],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}]};
test('canonical Worker solves directional bar and validates saved case across archive and view',async()=>{
 const output=await analyzeProject(project,{method:'wasm-pcg',size:5});assert.ok(Math.abs(output.result.maxDisplacementMm-.04/3)<1e-8);assert.ok(Math.abs(output.result.reaction[2]+100)<1e-6);assert.deepEqual(output.result.orthotropic,orthotropic);
 const store=createCaseStore();store.add('Synthetic directional bar',output);const archive=JSON.parse(JSON.stringify(store.export()));store.import(archive);prepareCaseView(store.list()[0]);const altered=structuredClone(archive);altered.cases[0].output.result.orthotropic.source='Changed calibration';assert.throws(()=>store.import(altered));assert.equal(store.list().length,1);
 const rotated=structuredClone(project);rotated.materialProperties.orthotropic.axes=[[0,1,0],[0,0,1],[1,0,0]];const second=await analyzeProject(rotated,{method:'pcg-strict',size:5});assert.ok(Math.abs(second.result.maxDisplacementMm-.02)<1e-8);
});
test('Worker rejects unsupported orthotropic solvers and disciplines before calculation',async()=>{
 await assert.rejects(analyzeProject(project,{method:'mfem-wasm'}),/Orthotropic/);for(const study of [{kind:'structural',modalAnalysis:true},{kind:'structural',thermalStress:true,temperature:30,referenceTemperature:20},{kind:'thermal'}])await assert.rejects(analyzeProject({...project,study}),/Orthotropic/);
});

