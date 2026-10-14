import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSession,browserMethods} from '../src/browser-session.js';

test('case source routes use edit scope, guard and the shared mutation lock',async()=>{
 let busy=true,resume,entered;const started=new Promise(resolve=>entered=resolve),seen=[],caseSources={async apply(args,{guard}){seen.push(args);entered();await new Promise(resolve=>resume=resolve);if(!guard())throw Error('expired');return {revision:'prepared'};},async clear(args,{guard}){assert.equal(guard(),true);return {revision:args.expectedRevision};}},session=createBrowserSession({caseSources,isBusy:()=>busy});
 for(const method of ['applyCaseSource','clearCaseSource']){assert.equal(browserMethods[method],'edit');await assert.rejects(session.call(method,{}),/busy/);await assert.rejects(createBrowserSession({}).call(method,{}),/unavailable/);}
 busy=false;const pending=session.call('applyCaseSource',{expectedRevision:'old'});await started;await assert.rejects(session.call('clearCaseSource',{}),/busy/);await assert.rejects(session.call('setView',{}),/busy/);session.disconnect();resume();await assert.rejects(pending,/expired/);assert.deepEqual(seen,[{expectedRevision:'old'}]);assert.deepEqual(await session.call('clearCaseSource',{expectedRevision:'current',jobId:'job'}),{revision:'current'});
});
