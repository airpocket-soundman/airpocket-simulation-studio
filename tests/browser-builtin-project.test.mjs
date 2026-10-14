import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBrowserBuiltinProject} from '../src/browser-builtin-project.js';
import {createProjectFromBuiltin} from '../src/project-import.js';
test('browser builtin normalization resets model state and uses detached startup study defaults',()=>{
 const project=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}}),initial={kind:'structural',gravityEnabled:true,gravity:[0,0,-9.81],modalAnalysis:false,modeCount:2,timeStep:1,steps:10,temperatureSource:{old:true},vibrationSource:{old:true},plasticLoadFractions:[1]};
 const normalized=normalizeBrowserBuiltinProject(project,initial);
 assert.deepEqual(normalized.materialProperties,{});assert.deepEqual(normalized.conditions,[]);assert.deepEqual(normalized.meshSettings,{refinements:[]});assert.equal(normalized.meshes[0].kind,'cad');assert.equal(normalized.study.gravityEnabled,false);assert.equal(normalized.study.modeCount,2);
 for(const key of ['temperatureSource','vibrationSource','plasticLoadFractions'])assert.equal(normalized.study[key],undefined);
 normalized.study.gravity[0]=1;normalized.meshes[0].positions[0]=999;assert.equal(initial.gravity[0],0);assert.notEqual(project.meshes[0].positions[0],999);assert.equal(project.meshSettings,undefined);
});
