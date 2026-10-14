import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSession,browserMethods} from '../src/browser-session.js';

test('assessment routes preserve options, bounded page arguments and analyze/inspect scopes',async()=>{
 const calls=[],assessments={get:args=>{calls.push(args);return {page:{elements:[]}};},evaluate:(args,{guard})=>{assert.equal(guard(),true);calls.push(args);return {resultRevision:'next'};}};
 const session=createBrowserSession({assessments});
 const query={kind:'fatigue',offset:200,limit:25};assert.deepEqual(await session.call('getAssessment',query),{page:{elements:[]}});assert.equal(calls[0],query);
 const command={kind:'fracture',expectedResultRevision:'previous',options:{geometryFactorRange:[1,1]}};assert.equal((await session.call('evaluateAssessment',command)).resultRevision,'next');assert.equal(calls[1],command);
 assert.equal(browserMethods.evaluateAssessment,'analyze');assert.equal(browserMethods.getAssessment,'inspect');
});

test('pending assessment is exclusive and revocation reaches the final commit guard',async()=>{
 let resume,committed=false;
 const session=createBrowserSession({assessments:{evaluate:async(args,{guard})=>{await new Promise(resolve=>{resume=resolve;});if(!guard())throw Error('expired');committed=true;}}});
 const pending=session.call('evaluateAssessment',{kind:'fatigue'});await assert.rejects(session.call('setView',{}),/busy/);session.disconnect();resume();await assert.rejects(pending,/expired/);assert.equal(committed,false);
});
