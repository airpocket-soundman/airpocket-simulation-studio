import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createAnalysisJobs} from '../src/analysis-jobs.js';
import {analysisError,createAnalysisFailure,restoreAnalysisError} from '../src/analysis-failure.js';
const rich=()=>restoreAnalysisError('original execution message',createAnalysisFailure(analysisError('ANALYSIS_BOUNDARY_TRANSFER_FAILED','boundary details',{stage:'boundary-transfer',target:'/conditions/0',evidence:{conditionIndex:0}})));
test('job failures keep JOB_FAILED and legacy messages while attaching validated detached metadata',async()=>{
 const runtime=createAnalysisJobs({execute:async()=>{throw rich();}}),job=runtime.start({project:{},inputRevision:'rev'});await runtime.drain();const state=runtime.get(job.jobId);assert.equal(state.state,'failed');assert.equal(state.error.code,'JOB_FAILED');assert.equal(state.error.message,'original execution message');assert.equal(state.error.failure.code,'ANALYSIS_BOUNDARY_TRANSFER_FAILED');assert.equal(state.executionSettled,true);assert.equal(state.releaseAllowed,true);assert.equal(runtime.events(job.jobId).events.find(e=>e.type==='state'&&e.state==='failed').error.failure.stage,'boundary-transfer');state.error.failure.diagnostics[0].evidence.conditionIndex=9;assert.equal(runtime.get(job.jobId).error.failure.diagnostics[0].evidence.conditionIndex,0);runtime.release(job.jobId);
});
test('untagged and malformed failures do not acquire unvalidated diagnostic payloads',async()=>{
 for(const error of [Error('old behavior'),Object.assign(Error('malformed'),{analysisFailure:{schemaVersion:1,code:'ANALYSIS_TEST'}})]){const runtime=createAnalysisJobs({execute:async()=>{throw error;}}),job=runtime.start({project:{},inputRevision:'rev'});await runtime.drain();assert.equal(runtime.get(job.jobId).error.failure,undefined);assert.equal(runtime.get(job.jobId).error.code,'JOB_FAILED');runtime.release(job.jobId);}
});
test('cancel and timeout ownership remain terminal while late execution failure carries primary metadata',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 for(const action of ['cancel','timeout']){
  let rejectExecution;const runtime=createAnalysisJobs({timeoutMs:20,execute:()=>new Promise((_,reject)=>rejectExecution=reject)}),job=runtime.start({project:{},inputRevision:action});await nextTurn();if(action==='cancel')runtime.cancel(job.jobId);else t.mock.timers.tick(25);
  let state=runtime.get(job.jobId);assert.equal(state.error.code,action==='cancel'?'JOB_CANCELLED':'JOB_TIMEOUT');assert.equal(state.error.failure,undefined);assert.equal(state.releaseAllowed,false);assert.throws(()=>runtime.release(job.jobId),/not settled/);
  rejectExecution(new AggregateError([rich(),Error('cleanup detail')],'combined execution failure'));await runtime.drain();state=runtime.get(job.jobId);assert.equal(state.state,action==='cancel'?'cancelled':'timed_out');assert.equal(state.error.code,action==='cancel'?'JOB_CANCELLED':'JOB_TIMEOUT');assert.equal(state.executionError.code,'JOB_EXECUTION_REJECTED_AFTER_TERMINAL');assert.equal(state.executionError.failure.stage,'boundary-transfer');assert.equal(state.executionSettled,true);assert.equal(state.releaseAllowed,true);runtime.release(job.jobId);
 }
});
