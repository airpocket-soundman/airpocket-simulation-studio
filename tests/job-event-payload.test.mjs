import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analysisError,createAnalysisFailure,getAnalysisFailure} from '../src/analysis-failure.js';
import {jobEventPayloadLimits,snapshotJobEvent,snapshotJobView,normalizeJobError} from '../src/job-event-payload.js';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
const envelope={schemaVersion:1,jobId:'job',inputRevision:'revision',sequence:12,type:'progress',elapsedMs:10};
function failure(){
 const value=createAnalysisFailure(analysisError('ANALYSIS_SOLVE_FAILED','あ'.repeat(1600),{stage:'solve',target:'/material',evidence:{reference:'test'},suggestions:['x'.repeat(300)]}));
 while(value.diagnostics.length<8){const proposed={...value,diagnostics:[...value.diagnostics,structuredClone(value.diagnostics[0])]};if(bytes(proposed)>16384)break;value.diagnostics=proposed.diagnostics;}
 assert.ok(getAnalysisFailure({analysisFailure:value}));assert.ok(bytes(value)>14000&&bytes(value)<=16384);return value;
}
test('event snapshot preserves finite metrics, optional wire metadata and authoritative cursor with exact UTF8 bytes',()=>{
 const source={stage:'iteration',sequence:999,metrics:{residual:.01,qualityHistogram:[1,2,3,4,5]},optional:undefined,message:'日本語',negativeZero:-0};
 const result=snapshotJobEvent(source,envelope);assert.equal(result.gap,false);assert.equal(result.event.sequence,12);assert.equal(result.bytes,bytes(result.event));assert.equal(result.event.optional,undefined);assert.equal(Object.hasOwn(result.event,'optional'),false);assert.deepEqual(result.event.metrics,source.metrics);source.metrics.qualityHistogram[0]=99;assert.equal(result.event.metrics.qualityHistogram[0],1);
 assert.deepEqual(jobEventPayloadLimits,{eventBytes:32768,retainedBytes:1048576,pageBytes:65536,viewBytes:24576,messageChars:2048});assert.equal(Object.isFrozen(jobEventPayloadLimits),true);
});
test('UTF8 event boundaries retain fitting text and substitute same-sequence gap for oversized payloads',()=>{
 const overhead=bytes({...envelope,stage:'progress',message:''});
 const fitting=snapshotJobEvent({stage:'progress',message:'a'.repeat(32768-overhead)},envelope);assert.equal(fitting.gap,false);assert.equal(fitting.bytes,32768);
 const beyond=snapshotJobEvent({stage:'progress',message:'a'.repeat(32769-overhead)},envelope);assert.equal(beyond.gap,true);assert.equal(beyond.event.sequence,12);assert.equal(beyond.event.type,'progress');assert.equal(beyond.event.gap.reason,'bytes');assert.equal(beyond.event.gap.originalStage,'progress');assert.equal(beyond.event.payloadOmitted,true);assert.equal(beyond.event.provisional,true);
 const japanese=snapshotJobEvent({stage:'progress',message:'あ'.repeat(11000)},envelope);assert.equal(japanese.gap,true);assert.ok(japanese.bytes<32768);
});
test('unsafe, cyclic, sparse and structural-overflow input never invokes getters or serialization hooks',()=>{
 let called=false;const getter={stage:'iteration',get hidden(){called=true;return 1;}},cycle={};cycle.self=cycle;
 const examples=[[getter,'accessor'],[cycle,'cycle'],[{value:NaN},'non-finite'],[{value:Infinity},'non-finite'],[{callback(){}},'unsupported-type'],[{value:1n},'unsupported-type'],[{array:[undefined]},'unsupported-type'],[{array:Array(2)},'unsupported-type'],[{array:new Float64Array(1000000)},'unsupported-type'],[{array:Array(1000000)},'structure-limit']];
 for(const [source,reason]of examples){const result=snapshotJobEvent(source,envelope);assert.equal(result.gap,true);assert.equal(result.event.gap.reason,reason);assert.equal(result.event.sequence,12);assert.ok(result.bytes<=32768);}
 const hook={text:'x'.repeat(1000000),toJSON(){called=true;throw Error('do not serialize');}};assert.equal(snapshotJobEvent(hook,envelope).gap,true);assert.equal(called,false);
 assert.throws(()=>snapshotJobView({result:getter}));assert.equal(called,false);assert.throws(()=>snapshotJobView({result:{callback(){}}}));assert.throws(()=>snapshotJobView({result:cycle}));
});
test('validated diagnostic failure stays intact while registry message copies are bounded',()=>{
 const diagnostic=failure(),record={code:'JOB_FAILED',sourceCode:'ANALYSIS_SOLVE_FAILED',message:'z'.repeat(1000000),failure:diagnostic};
 const event=snapshotJobEvent({stage:'diagnostic',failure:diagnostic},envelope);assert.equal(event.gap,false);assert.deepEqual(event.event.failure,diagnostic);assert.ok(event.bytes<=32768);
 const error=normalizeJobError(record);assert.equal(error.message.length,2048);assert.equal(error.messageTruncated,true);assert.equal(error.originalMessageLength,1000000);assert.equal(record.message.length,1000000);assert.equal(error.code,'JOB_FAILED');assert.deepEqual(error.failure,diagnostic);
 assert.deepEqual(normalizeJobError(error),error);assert.deepEqual(snapshotJobView({error}).error,error);
 const view=snapshotJobView({...envelope,error:record,result:{kind:'elastic',engine:'CPU',residual:.001,modeFrequenciesHz:[1,2],huge:'x'.repeat(1000000)}});assert.ok(bytes(view)<=24576);assert.deepEqual(view.error.failure,diagnostic);assert.equal(view.result.kind,'elastic');assert.equal(view.result.residual,.001);assert.deepEqual(view.result.modeFrequenciesHz,[1,2]);assert.ok(view.result.summaryOmissions.some(item=>item.field==='huge'));assert.equal(view.result.huge,undefined);
 let accessed=false;const unsafe=normalizeJobError({get message(){accessed=true;return 'secret';},failure:{bad:true}});assert.equal(accessed,false);assert.equal(unsafe.messageUnavailable,true);assert.equal(unsafe.failureOmitted,true);
 assert.deepEqual(normalizeJobError(unsafe),unsafe);
});
test('normal result summaries remain compatible with optional undefined object fields',()=>{
 const result={kind:'thermal',engine:'CPU',residual:0,minTemperature:20,maxTemperature:100,qualityHistogram:[1,2,3,4,5],modeFrequenciesHz:undefined};
 const view=snapshotJobView({schemaVersion:1,result,error:undefined});assert.deepEqual(view,{schemaVersion:1,result:{kind:'thermal',engine:'CPU',residual:0,minTemperature:20,maxTemperature:100,qualityHistogram:[1,2,3,4,5]}});
 assert.deepEqual(snapshotJobView({result:undefined}),{});assert.throws(()=>snapshotJobView({result:{values:[undefined]}}));
 for(const maxBytes of [0,Infinity,32769])assert.throws(()=>snapshotJobEvent({},envelope,{maxBytes}));
});
