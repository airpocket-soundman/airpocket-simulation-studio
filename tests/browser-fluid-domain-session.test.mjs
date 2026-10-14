import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSession,browserMethods} from '../src/browser-session.js';

test('fluid domain routes use edit scope, guard and the shared mutation lock',async()=>{
 let busy=true,resume,entered;const started=new Promise(resolve=>entered=resolve),seen=[],fluidDomains={async prepare(args,{guard}){seen.push(args);entered();await new Promise(resolve=>resume=resolve);if(!guard())throw Error('expired');return {revision:'prepared'};},async applyMesh(args,{guard}){assert.equal(guard(),true);return {revision:args.expectedRevision};}},session=createBrowserSession({fluidDomains,isBusy:()=>busy});
 for(const method of ['prepareFluidDomain','applyFluidDomainMesh']){assert.equal(browserMethods[method],'edit');await assert.rejects(session.call(method,{}),/busy/);await assert.rejects(createBrowserSession({}).call(method,{}),/unavailable/);}
 busy=false;const pending=session.call('prepareFluidDomain',{expectedRevision:'old'});await started;await assert.rejects(session.call('applyFluidDomainMesh',{}),/busy/);await assert.rejects(session.call('setView',{}),/busy/);session.disconnect();resume();await assert.rejects(pending,/expired/);assert.deepEqual(seen,[{expectedRevision:'old'}]);assert.deepEqual(await session.call('applyFluidDomainMesh',{expectedRevision:'current',jobId:'job'}),{revision:'current'});
});
