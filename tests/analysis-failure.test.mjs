import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analysisError,createAnalysisFailure,restoreAnalysisError,getAnalysisFailure} from '../src/analysis-failure.js';
const tagged=()=>analysisError('ANALYSIS_CONSTRAINT_RANK','Rigid-body rank is incomplete',{stage:'constraints',target:'/conditions',evidence:{body:0,rank:3,requiredRank:6},suggestions:['Review intended supports']});
test('tagged original messages and structured diagnostics survive transport detached',()=>{
 const error=tagged(),f=createAnalysisFailure(error,{stage:'solve'});assert.equal(error.message,'Rigid-body rank is incomplete');assert.equal(f.schemaVersion,1);assert.equal(f.code,'ANALYSIS_CONSTRAINT_RANK');assert.equal(f.stage,'constraints');assert.equal(f.diagnostics[0].evidence.rank,3);assert.equal(f.diagnostics[0].requiresUserIntent,true);
 const restored=restoreAnalysisError('legacy wire message',JSON.parse(JSON.stringify(f)));assert.equal(restored.message,'legacy wire message');assert.equal(restored.code,f.code);assert.deepEqual(getAnalysisFailure(restored),f);f.diagnostics[0].evidence.rank=0;assert.equal(getAnalysisFailure(error).diagnostics[0].evidence.rank,3);assert.equal(getAnalysisFailure(restored).diagnostics[0].evidence.rank,3);
});
test('untagged failures use stable stage codes without altering original Error messages',()=>{
 const codes={preparation:'ANALYSIS_PREPARATION_FAILED',mesh:'ANALYSIS_MESH_FAILED','boundary-transfer':'ANALYSIS_BOUNDARY_TRANSFER_FAILED',constraints:'ANALYSIS_CONSTRAINTS_FAILED','temperature-transfer':'ANALYSIS_TEMPERATURE_TRANSFER_FAILED','material-evaluation':'ANALYSIS_MATERIAL_EVALUATION_FAILED',solve:'ANALYSIS_SOLVE_FAILED',postprocess:'ANALYSIS_POSTPROCESS_FAILED',unknown:'ANALYSIS_FAILED'};
 for(const [stage,code]of Object.entries(codes)){const error=Error('Original message'),failure=createAnalysisFailure(error,{stage});assert.equal(error.message,'Original message');assert.equal(failure.code,code);assert.equal(failure.stage,stage);assert.equal(getAnalysisFailure(error),null);}
 assert.equal(createAnalysisFailure('string failure',{stage:'invalid'}).code,'ANALYSIS_FAILED');assert.equal(createAnalysisFailure(null).message,'Analysis failed');
});
test('bounded evidence rejects non-JSON details and never exposes stacks, causes or getters',()=>{
 let accesses=0;const cycle={};cycle.self=cycle;
 const evidence={small:3,large:Array.from({length:10000},(_,i)=>i),stack:'secret stack',cause:{secret:true},date:new Date(),fn:()=>{},nan:NaN,cycle};Object.defineProperty(evidence,'getter',{enumerable:true,get(){accesses++;throw Error('getter accessed');}});
 const error=analysisError('ANALYSIS_TEST','x'.repeat(10000),{stage:'solve',evidence,suggestions:Array(100).fill('s'.repeat(10000)),target:'t'.repeat(10000)});error.cause=Error('private cause');const f=createAnalysisFailure(error);
 assert.equal(error.message.length,10000);assert.ok(f.message.length<=2000);assert.ok(f.diagnostics[0].target.length<=300);assert.ok(f.diagnostics[0].suggestions.length<=6);assert.ok(f.diagnostics[0].suggestions.every(x=>x.length<=300));assert.ok(f.diagnostics[0].evidence.large.length<=16);assert.equal(accesses,0);for(const key of ['stack','cause','date','fn','nan','getter'])assert.equal(Object.hasOwn(f.diagnostics[0].evidence,key),false);assert.ok(new TextEncoder().encode(JSON.stringify(f)).length<=16384);assert.doesNotThrow(()=>JSON.stringify(f));
 const huge=Object.fromEntries(Array.from({length:16},(_,i)=>['a'+i,Array(16).fill('界'.repeat(400))]));const large=createAnalysisFailure(analysisError('ANALYSIS_TEST','界'.repeat(2000),{evidence:huge,suggestions:Array(6).fill('界'.repeat(300))}));assert.ok(new TextEncoder().encode(JSON.stringify(large)).length<=16384);assert.ok(getAnalysisFailure(restoreAnalysisError('old',large)));
});
test('malformed worker payloads retain legacy behavior without trusting injected fields',()=>{
 const valid=createAnalysisFailure(tagged());
 for(const mutate of [f=>f.schemaVersion=2,f=>f.code='JOB_FAILED',f=>f.stage='imaginary',f=>f.message='mismatch',f=>f.extra='stack',f=>f.diagnostics=[],f=>f.diagnostics[0].evidence.stack='leak',f=>f.diagnostics[0].evidence.x=Infinity,f=>f.diagnostics[0].suggestions=Array(7).fill('x'),f=>f.diagnostics[0].message='x'.repeat(2001),f=>f.diagnostics[0].requiresUserIntent='true']){const f=structuredClone(valid);mutate(f);const e=restoreAnalysisError('legacy',f);assert.equal(e.message,'legacy');assert.equal(e.analysisFailure,undefined);assert.equal(e.code,undefined);assert.equal(getAnalysisFailure(e),null);}
 let accesses=0;const bad=structuredClone(valid);Object.defineProperty(bad,'code',{enumerable:true,get(){accesses++;throw Error('bad');}});assert.equal(getAnalysisFailure(restoreAnalysisError('legacy',bad)),null);assert.equal(accesses,0);
 const accessorArray=structuredClone(valid);Object.defineProperty(accessorArray.diagnostics,'0',{enumerable:true,get(){accesses++;throw Error('bad');}});assert.equal(getAnalysisFailure(restoreAnalysisError('legacy',accessorArray)),null);assert.equal(accesses,0);
 assert.equal(getAnalysisFailure({analysisFailure:new Proxy({}, {getOwnPropertyDescriptor(){throw Error('trap');}})}),null);
});
test('AggregateError retains first available primary metadata without exposing cleanup error strings',()=>{
 const primary=restoreAnalysisError('primary message',createAnalysisFailure(tagged())),aggregate=new AggregateError([primary,Error('private cleanup detail')],'aggregate legacy message');assert.equal(getAnalysisFailure(aggregate).code,'ANALYSIS_CONSTRAINT_RANK');assert.equal(createAnalysisFailure(aggregate,{stage:'postprocess'}).stage,'constraints');assert.ok(!JSON.stringify(getAnalysisFailure(aggregate)).includes('private cleanup'));
 const cycle=new AggregateError([],'cycle');cycle.errors.push(cycle,aggregate);assert.equal(getAnalysisFailure(cycle).code,'ANALYSIS_CONSTRAINT_RANK');
 const malformed=new Proxy({}, {getOwnPropertyDescriptor(){throw Error('malformed metadata owner');}});assert.equal(getAnalysisFailure(new AggregateError([malformed,aggregate],'legacy')).code,'ANALYSIS_CONSTRAINT_RANK');
});
