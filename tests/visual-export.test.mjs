import {test} from 'node:test';
import assert from 'node:assert/strict';
import {animationState} from '../src/visual-export.js';
test('visual animation returns to undeformed geometry and visits all stored time frames without overflow',()=>{assert.equal(animationState('deformation',0,{scale:20}).deformScale,0);assert.equal(animationState('deformation',.5,{scale:20}).deformScale,20);assert.equal(animationState('deformation',1,{scale:20}).deformScale,0);assert.equal(animationState('time',1,{frames:6}).frame,5);assert.equal(animationState('slice',.5,{min:-20,max:40}).position,10);assert.throws(()=>animationState('time',NaN));assert.throws(()=>animationState('time',1,{frames:0}));});
import {exportFormatCapabilities} from '../src/visual-export.js';
test('MP4 remains unsupported and GIF canvas support is independent of recorder probes',()=>{
 const yes=exportFormatCapabilities({mediaRecorder:{isTypeSupported:type=>type.startsWith('video/mp4')}}),no=exportFormatCapabilities({mediaRecorder:{isTypeSupported:()=>false}}),none=exportFormatCapabilities(),throwing=exportFormatCapabilities({mediaRecorder:{isTypeSupported(){throw Error('x');}}});
 assert.equal(yes.mp4.supported,false);assert.equal(yes.mp4.browserRecorderSupport,true);assert.match(yes.mp4.probedMimeType,/^video\/mp4/);assert.match(yes.mp4.reason,/not implemented/);
 for(const c of [no,none,throwing]){assert.equal(c.mp4.supported,false);assert.equal(c.mp4.browserRecorderSupport,false);assert.match(c.mp4.reason,/does not support the MP4 container/);}
 for(const c of [yes,no,none]){assert.deepEqual(c.mp4.alternatives,['webm','png']);assert.equal(c.gif.supported,false);assert.match(c.gif.reason,/readable 2D canvas/);assert.deepEqual(c.gif.alternatives,['webm','png']);}
});


test('orbit GIF capability requires canvas pixels and SHA, not MediaRecorder',()=>{const cap=exportFormatCapabilities({createCanvas:()=>({getContext:()=>({getImageData(){},drawImage(){}})})});assert.equal(cap.gif.supported,true);assert.deepEqual(cap.gif.animations,['orbit']);assert.equal(cap.gif.frames,24);assert.equal(cap.gif.width,640);assert.equal(cap.gif.height,320);assert.equal(cap.mp4.supported,false);});
