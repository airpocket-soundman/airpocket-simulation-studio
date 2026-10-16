import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTimeViewState} from '../src/ui/time-view-state.js';

test('export restoration preserves exact interpolation time and labels without slider events',()=>{
 let state={frameIndex:1,timeSeconds:.123456789123},stopped=0;
 const elements={
  'acoustic-time-frame':{value:'1'},'acoustic-time-fine':{value:'417'},
  'acoustic-time-label':{textContent:'0.1235 s'},'acoustic-time-interpolated':{textContent:'Interpolated temperature'}
 };
 for(const el of Object.values(elements))el.dispatchEvent=()=>assert.fail('Restoration must not dispatch rounded slider input');
 const hooks=createTimeViewState({$:id=>elements[id],getState:()=>state,setState:s=>{state=s;},stop:()=>stopped++});
 const saved=hooks.getTimeView();
 state.frameIndex=4;state.timeSeconds=null;
 elements['acoustic-time-frame'].value='4';elements['acoustic-time-fine'].value='1000';
 elements['acoustic-time-label'].textContent='Final step';elements['acoustic-time-interpolated'].textContent='';
 hooks.restoreTimeView(saved);
 assert.equal(stopped,1);assert.deepEqual(state,{frameIndex:1,timeSeconds:.123456789123});
 assert.equal(elements['acoustic-time-frame'].value,'1');assert.equal(elements['acoustic-time-fine'].value,'417');
 assert.equal(elements['acoustic-time-label'].textContent,'0.1235 s');
 assert.equal(elements['acoustic-time-interpolated'].textContent,'Interpolated temperature');
});

test('stored frame or absent controls restore safely without fabricating interpolation',()=>{
 let state={frameIndex:2,timeSeconds:null};
 const hooks=createTimeViewState({$:()=>null,getState:()=>state,setState:s=>{state=s;}}),saved=hooks.getTimeView();
 state={frameIndex:0,timeSeconds:2.2};hooks.restoreTimeView(saved);
 assert.deepEqual(state,{frameIndex:2,timeSeconds:null});
 assert.deepEqual(saved.controls,[]);hooks.restoreTimeView(null);
});
