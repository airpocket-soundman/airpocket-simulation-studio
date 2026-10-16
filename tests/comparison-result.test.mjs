import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectComparisonResult,comparisonFrame} from '../src/comparison-result.js';
import {resolveSharedTime} from '../src/view-compare-layout.js';

const thermal=()=>({kind:'thermal',transient:true,temperature:[100],snapshots:[{time:0,temperature:[20]},{time:3,temperature:[60]},{time:6,temperature:[100]}]});
test('thermal comparison maps physical seconds to stored temperature frames',()=>{
 const result=thermal(),before=structuredClone(result),info=inspectComparisonResult(result,'temperature');
 assert.deepEqual(info.frameTimes,[0,3,6]);
 const [time]=resolveSharedTime([{caseId:'a',...info},{caseId:'b',frameTimes:[0,2,6]}],{timeSeconds:2.7});
 assert.equal(time.frameIndex,1);assert.ok(Math.abs(time.offsetSeconds-.3)<1e-12);
 assert.deepEqual(comparisonFrame(result,'temperature',time.frameIndex),{frameIndex:1,physicalTimeSeconds:3,timeSelection:'stored-frames-only'});
 assert.equal(comparisonFrame(result,'temperature').frameIndex,2);
 assert.deepEqual(result,before);
});
test('thermal final-only heat flux never borrows a temperature timestamp',()=>{
 const result=thermal();
 assert.deepEqual(inspectComparisonResult(result,'heatFlux'),{fields:['temperature','heatFlux'],frameTimes:null,finalOnly:true});
 assert.deepEqual(comparisonFrame(result,'heatFlux'),{frameIndex:2,finalOnly:true});
 assert.throws(()=>comparisonFrame(result,'heatFlux',0),/final-step only/);
 assert.throws(()=>comparisonFrame(result,'heatFlux',2),/final-step only/);
});
test('invalid frames and unavailable fields fail before rendering',()=>{
 for(const frame of [-1,3,.5,NaN])assert.throws(()=>comparisonFrame(thermal(),'temperature',frame),/Invalid stored/);
 assert.throws(()=>comparisonFrame(thermal(),'stress',0),/unavailable/);
 const legacy={kind:'thermal',transient:true,temperature:[42]};
 assert.equal(inspectComparisonResult(legacy,'temperature').frameTimes,null);
 assert.equal(inspectComparisonResult(legacy,'temperature').finalOnly,true);
 assert.throws(()=>comparisonFrame(legacy,'temperature',0),/Invalid stored/);
 assert.equal(comparisonFrame(legacy,'temperature').physicalTimeSeconds,undefined);
});
test('acoustic stored frames retain seconds and static results retain no time axis',()=>{
 const acoustic={kind:'acousticTransient',snapshots:[{time:0,pressure:[0]},{time:.001,pressure:[1]}]};
 assert.deepEqual(inspectComparisonResult(acoustic,'instantPressure').frameTimes,[0,.001]);
 assert.equal(comparisonFrame(acoustic,'instantPressure',1).physicalTimeSeconds,.001);
 assert.equal(comparisonFrame(acoustic,'instantPressure').frameIndex,0);
 assert.deepEqual(inspectComparisonResult({kind:'elastic'},'stress'),{fields:['displacement','stress'],frameTimes:null});
});
