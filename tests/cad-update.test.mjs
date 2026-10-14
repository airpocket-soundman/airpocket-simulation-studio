import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BoxGeometry,ShapeUtils,Vector2} from 'three';
import {createStudioApi} from '../src/studio-api.js';
import {createAnalysisClient} from '../src/analysis-client.js';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
import {validateProject} from '../src/regions.js';
import {planCadUpdate} from '../src/cad-update.js';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
const source={kind:'step',data:readFileSync(new URL('./fixtures/cad-update-reference.step',import.meta.url)).toString('base64')};
function box(x=0){const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5+x,5,20);const mesh={kind:'cad',positions:Array.from(g.attributes.position.array),faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))};g.dispose();return mesh;}
const at=(mesh,z)=>mesh.faceIds.flatMap((_,t)=>[2,5,8].every(k=>mesh.positions[9*t+k]===z)?[t]:[]);
function project(meshes=[box()]){return {version:1,name:'CAD axial reference',sourceModel:structuredClone(source),meshes,selection:meshes.map(()=>[]),material:'金属',materialProperties:{youngModulus:1e9,poissonRatio:0,density:1000},study:{kind:'structural',gravityEnabled:false},conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:at(meshes[0],0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:at(meshes[0],40)}]}]};}
function refine(mesh){const positions=[],faceIds=[];for(let t=mesh.faceIds.length-1;t>=0;t--){const p=[0,1,2].map(i=>mesh.positions.slice(t*9+3*i,t*9+3*i+3)),mid=(a,b)=>p[a].map((v,k)=>(v+p[b][k])/2),v=[...p,mid(0,1),mid(0,2),mid(1,2)];for(const ids of [[0,3,4],[3,1,5],[4,5,2],[3,5,4]]){positions.push(...ids.flatMap(i=>v[i]));faceIds.push(mesh.faceIds[t]+50);}}return {kind:'cad',positions,faceIds};}
const replacement=meshes=>({name:'Updated CAD',sourceModel:structuredClone(source),meshes});
test('CAD face matching survives renumbering, planar retessellation and reordered parts without mutating input',()=>{
 const p=project([box(),box(50)]),original=structuredClone(p),next=[refine(p.meshes[1]),refine(p.meshes[0])],plan=planCadUpdate(p,replacement(next));assert.equal(plan.matched,2);assert.equal(plan.pending,0);assert.deepEqual(p,original);assert.equal(plan.project.conditions[0].regions[0].mesh,1);assert.equal(plan.project.conditions[0].regions[0].triangles.length,8);assert.deepEqual(plan.project.conditions[1].direction,[0,0,1]);assert.equal(plan.project.conditions[1].value,100);assert.deepEqual(plan.project.materialProperties,p.materialProperties);assert.deepEqual(plan.project.study,p.study);
 const api=createStudioApi();api.loadProject(p);assert.equal(api.previewCadUpdate(replacement(next)).matched,2);assert.deepEqual(api.exportProject(),original);api.applyCadUpdate(replacement(next));assert.deepEqual(api.exportProject(),plan.project);
});
test('partial faces transfer only when their actual triangles remain identifiable, otherwise retain unresolved conditions',()=>{
 const p=project();p.conditions[1].regions[0].triangles=[8];const same={...box(),positions:[],faceIds:[]};for(let t=11;t>=0;t--){same.positions.push(...p.meshes[0].positions.slice(t*9,t*9+9));same.faceIds.push(p.meshes[0].faceIds[t]+100);}assert.equal(planCadUpdate(p,replacement([same])).pending,0);
 const api=createStudioApi();api.loadProject(p);api.applyCadUpdate(replacement([refine(box())]));const pending=api.exportProject();assert.equal(pending.conditions.length,2);assert.equal(pending.conditions[1].value,100);assert.equal(pending.conditions[1].cadUpdateRequired.reason,'partial-selection');assert.deepEqual(pending.conditions[1].regions,[]);const restored=createStudioApi();restored.loadProject(JSON.parse(JSON.stringify(pending)));assert.deepEqual(restored.exportProject(),pending);assert.equal(restored.getSummary().unresolvedCadConditions,1);restored.selectTriangles(0,at(pending.meshes[0],40));restored.replaceConditionRegion(1);assert.equal(restored.exportProject().conditions[1].cadUpdateRequired,undefined);assert.equal(restored.exportProject().conditions[1].value,100);
});
test('missing or coincident faces require reselection rather than numeric face-index fallback',()=>{
 const p=project(),moved=box();moved.positions=moved.positions.map((v,i)=>i%3===2&&v===40?50:v);const missing=planCadUpdate(p,replacement([moved]));assert.equal(missing.pending,1);assert.equal(missing.reports[1].reason,'missing-face');assert.equal(missing.project.conditions[1].value,100);
 const duplicate=planCadUpdate(p,replacement([box(),box()]));assert.equal(duplicate.pending,2);assert.ok(duplicate.reports.every(r=>r.reason==='ambiguous-face'));
 const old=project([box(),box()]),one=planCadUpdate(old,replacement([box()]));assert.equal(one.pending,2);
});
test('planar outlines distinguish different concave shapes with equal bounds, area and centroid',()=>{
 const h=[[-3,-3],[-1,-3],[-1,-1],[1,-1],[1,-3],[3,-3],[3,3],[1,3],[1,1],[-1,1],[-1,3],[-3,3]],polygon=points=>{const triangles=ShapeUtils.triangulateShape(points.map(p=>new Vector2(...p)),[]);return {kind:'cad',positions:triangles.flatMap(t=>t.flatMap(i=>[...points[i],0])),faceIds:triangles.map(()=>0)};},a=polygon(h),b=polygon(h.map(([x,y])=>[-y,x])),p={version:1,sourceModel:source,meshes:[a],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:a.faceIds.map((_,i)=>i)}]}]};assert.equal(planCadUpdate(p,replacement([b])).pending,1);
});
test('dimensional planar regions retain their recipes when their parent face still matches',()=>{
 const api=createStudioApi();api.loadProject(project());api.removeCondition(1);api.selectPlanarRegion(0,{axis:2,position:40,min:[2,2],max:[8,8]});api.addCondition({type:'force',value:100,direction:[0,0,1]});const before=api.exportProject();api.applyCadUpdate(replacement([refine(box())]));const after=api.exportProject();assert.equal(after.conditions[1].cadUpdateRequired,undefined);assert.deepEqual(after.conditions[1].planarRegion,before.conditions[1].planarRegion);assert.ok(after.conditions[1].regions[0].triangles.length>before.conditions[1].regions[0].triangles.length);
});
test('unresolved CAD conditions reject numerical execution and invalid saved markers atomically',async()=>{
 const p=project(),moved=box();moved.positions=moved.positions.map((v,i)=>i%3===2&&v===40?50:v);const pending=planCadUpdate(p,replacement([moved])).project;let started=0;const client=createAnalysisClient(()=>pending,()=>{},{isIsolated:()=>true,createWorker:()=>{started++;throw Error('unexpected worker');}});await assert.rejects(client.analyze(),/Resolve CAD/);assert.equal(started,0);await assert.rejects(analyzeProject(pending,{size:4}),/Resolve CAD/);
 for(const mutate of [p=>p.conditions[1].cadUpdateRequired.reason='invented',p=>p.conditions[1].value=NaN,p=>delete p.conditions[1].cadUpdateRequired,p=>p.conditions[1].regions=[{mesh:0,triangles:[0]}]]){const bad=structuredClone(pending);mutate(bad);assert.throws(()=>validateProject(bad));}
 const api=createStudioApi();api.loadProject(p);const before=api.exportProject();assert.throws(()=>api.applyCadUpdate({sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},meshes:[box()]}));assert.deepEqual(api.exportProject(),before);
});
test('real STEP worker solves matched CAD conditions with conserved load and archived updated inputs',async()=>{
 const p=project(),updated=planCadUpdate(p,replacement([refine(box())])).project,output=await analyzeProject(updated,{size:4});assert.ok(Math.abs(output.result.maxDisplacementMm/.04-1)<1e-7);assert.ok(Math.abs(output.result.reaction[2]+100)<1e-5);assert.ok(output.boundary.reports.every(r=>r.relativeAreaError<1e-7));const store=createCaseStore();store.add('Updated CAD',output);const restored=createCaseStore();restored.import(JSON.parse(JSON.stringify(store.export())));assert.deepEqual(prepareCaseView(restored.list()[0]).input,updated);
 const bad=store.export();const pending=structuredClone(updated.conditions[1]);pending.regions=[];pending.cadUpdateRequired={version:1,reason:'missing-face',previousAreaMm2:100,faces:[{mesh:0,faceId:4}]};bad.cases[0].output.input.conditions[1]=pending;assert.throws(()=>restored.import(bad),/Resolve CAD/);
});
