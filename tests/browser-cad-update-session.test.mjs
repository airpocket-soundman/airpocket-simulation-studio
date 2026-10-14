import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserMethods,createBrowserSession} from '../src/browser-session.js';

test('CAD update preview and application route revisioned replacements with inspect/edit scopes',async()=>{
 const calls=[],cadUpdates={preview:args=>{calls.push(args);return {matched:2,pending:0};},apply:(args,{guard})=>{assert.equal(guard(),true);calls.push(args);return {revision:'next'};}};
 const session=createBrowserSession({cadUpdates}),query={expectedRevision:'old',replacement:{sourceModel:{kind:'step'}},offset:1,limit:2};
 assert.equal((await session.call('previewCadUpdate',query)).matched,2);assert.equal(calls[0],query);
 const command={...query,expectedReplacementRevision:'replacement'};assert.equal((await session.call('applyCadUpdate',command)).revision,'next');assert.equal(calls[1],command);
 assert.equal(browserMethods.previewCadUpdate,'inspect');assert.equal(browserMethods.applyCadUpdate,'edit');
});

test('CAD update application serializes mutations and checks revocation at commit',async()=>{
 let resume,committed=false;
 const session=createBrowserSession({cadUpdates:{apply:async(args,{guard})=>{await new Promise(resolve=>{resume=resolve;});if(!guard())throw Error('expired');committed=true;}}});
 const pending=session.call('applyCadUpdate',{});await assert.rejects(session.call('setView',{}),/busy/);session.disconnect();resume();await assert.rejects(pending,/expired/);assert.equal(committed,false);
});
