import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preflightProject,requireAnalysisPreflight} from '../src/analysis-preflight.js';
import {createProjectFromBuiltin} from '../src/project-import.js';
test('observation declaration does not approve missing physical inputs',()=>{
 const project=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,10]}}),before=structuredClone(project);
 const report=preflightProject(project,{includeFields:true});
 assert.equal(report.allowed,false);assert.equal(report.selectedObservation.supported,true);assert.equal(report.selectedObservation.fieldRetention.requested,true);assert.equal(report.selectedObservation.declarationOnly,true);assert.equal(report.selectedObservation.physicalAccuracyVerified,false);assert.ok(report.diagnostics.some(d=>d.code==='MATERIAL_REQUIRED'));assert.deepEqual(project,before);
});
test('mesh preflight selects mesh observation independently of an unsupported solve model',()=>{
 const project=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,10]}});project.study={kind:'fluidDomain'};
 const report=preflightProject(project,{includeFields:true},{operation:'mesh'});
 assert.equal(report.allowed,true);assert.equal(report.selectedObservation.operation,'mesh');assert.equal(report.selectedObservation.supported,true);assert.deepEqual(report.selectedObservation.profile.fields,[]);assert.ok(report.selectedObservation.profile.events.some(e=>e.stage==='mesh'));
 // Saved physical assessment remains compatible: observation preferences are
 // discovery data, not a new accuracy/provenance assertion in saved results.
 const assessment=requireAnalysisPreflight(project,{}, {operation:'mesh'});assert.equal(assessment.selectedObservation,undefined);
});
test('invalid execution options remain inspectable structured preflight diagnostics',()=>{
 const project=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,10]}});
 for(const options of [{method:4},{adaptive:'yes'},{includeFields:'yes'}]){
  const report=preflightProject(project,options);assert.equal(report.selectedObservation.supported,false);assert.ok(report.selectedObservation.reasons.length);assert.equal(report.allowed,false);
 }
});
