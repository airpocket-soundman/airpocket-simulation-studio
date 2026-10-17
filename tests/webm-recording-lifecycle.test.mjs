import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWebmRecordingLifecycle,waitForWebmStop} from '../src/ui/webm-recording-lifecycle.js';
import {webmTestEnv} from './helpers/webm-test-env.mjs';
test('background admission, visibility interruption and resume-without-timer reject with stable reasons',async()=>{
 const initial=webmTestEnv();initial.hide();assert.throws(()=>createWebmRecordingLifecycle(initial.env),{code:'WEBM_BACKGROUND_INTERRUPTED'});assert.equal(initial.timers,0);
 const running=webmTestEnv(),lifecycle=createWebmRecordingLifecycle(running.env),failure=assert.rejects(lifecycle.race(new Promise(()=>{})),{code:'WEBM_BACKGROUND_INTERRUPTED'});running.hide();await failure;lifecycle.dispose();assert.equal(running.timers,0);
});
test('progress refreshes the no-frame watchdog; missing callbacks reject independently of animation callbacks',async()=>{
 const h=webmTestEnv(),guard=createWebmRecordingLifecycle(h.env);h.advance(4000);guard.progress();h.advance(4000);guard.progress();h.advance(4999);guard.check();const failure=assert.rejects(guard.race(new Promise(()=>{})),{code:'WEBM_PROGRESS_STALLED'});h.advance(1);await failure;guard.dispose();assert.equal(h.timers,0);
});
test('stop completion is bounded and successful stop removes the watchdog',async()=>{
 const h=webmTestEnv(),failure=assert.rejects(waitForWebmStop(new Promise(()=>{}),h.env),{code:'WEBM_STOP_TIMEOUT'});h.advance(2000);await failure;assert.equal(h.timers,0);await waitForWebmStop(Promise.resolve(),h.env);assert.equal(h.timers,0);
});
