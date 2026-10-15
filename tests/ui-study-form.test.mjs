import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudyFormUi} from '../src/ui/study-form-ui.js';

function setup(controls={}){const nodes={};const $=id=>nodes[id]??={value:'',checked:false};return {nodes,ui:createStudyFormUi({$,browserStudyControls:controls})};}

test('study controls read checkbox as checked and others as value, and write back',()=>{
 const {nodes,ui}=setup({a:{type:'checkbox'},b:{type:'number'}});
 nodes.a={checked:true};nodes.b={value:'7'};
 assert.deepEqual(ui.readBrowserStudyControls(),{a:true,b:'7'});
 ui.writeBrowserStudyControls({a:false,b:'9'});
 assert.equal(nodes.a.checked,false);assert.equal(nodes.b.value,'9');
});

test('adaptive options restore with defaults and percent scaling',()=>{
 const {nodes,ui}=setup();
 ui.restoreAdaptiveOptions({});
 assert.equal(nodes['adaptive-elements'].value,10000);assert.equal(nodes['adaptive-seconds'].value,60);
 assert.equal(nodes['adaptive-tolerance'].value,1);assert.equal(nodes['adaptive-stress-tolerance'].value,5);
 ui.restoreAdaptiveOptions({maxAdaptiveElements:0,maxAdaptiveSeconds:5,tolerance:.02,stressTolerance:.1});
 assert.equal(nodes['adaptive-elements'].value,0);assert.equal(nodes['adaptive-seconds'].value,5);
 assert.equal(nodes['adaptive-tolerance'].value,2);assert.equal(nodes['adaptive-stress-tolerance'].value,10);
});

test('internal fields round-trip through restore and options',()=>{
 const {nodes,ui}=setup();
 const s={enclosure:[1,2,3,4,5,6],seedPoint:[7,8,9],portPlanes:[0,3,5]};
 ui.restoreInternalFields(s);
 assert.equal(nodes['internal-width-z'].value,6);assert.equal(nodes['internal-port-3'].checked,true);assert.equal(nodes['internal-port-1'].checked,false);
 assert.deepEqual(ui.internalOptions(),s);
});
