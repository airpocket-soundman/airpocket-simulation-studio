import {test} from 'node:test';
import assert from 'node:assert/strict';
import {animationState} from '../src/visual-export.js';
test('visual animation returns to undeformed geometry and visits all stored time frames without overflow',()=>{assert.equal(animationState('deformation',0,{scale:20}).deformScale,0);assert.equal(animationState('deformation',.5,{scale:20}).deformScale,20);assert.equal(animationState('deformation',1,{scale:20}).deformScale,0);assert.equal(animationState('time',1,{frames:6}).frame,5);assert.equal(animationState('slice',.5,{min:-20,max:40}).position,10);assert.throws(()=>animationState('time',NaN));assert.throws(()=>animationState('time',1,{frames:0}));});
