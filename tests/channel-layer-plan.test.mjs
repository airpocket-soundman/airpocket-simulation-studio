import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChannelLayerPlan,channelLayerPlanScope,CHANNEL_LAYER_MAX_TOTAL} from '../src/channel-layer-plan.js';

const close=(actual,expected,tolerance=1e-12)=>Math.abs(actual-expected)<=tolerance;
const plan=settings=>createChannelLayerPlan(settings);

test('reference gap 10 mm places 0.1/0.2/0.4 mm per wall with an 8.6 mm centre band',()=>{
 const result=plan({gapMm:10,firstHeightMm:0.1,growthRatio:2,layersPerWall:3});
 assert.equal(result.units,'mm');
 assert.equal(result.output,'coordinate-placement-plan');
 assert.equal(result.scope.meshProduced,false);
 assert.equal(result.totalLayerCount,6);
 assert.equal(result.maxLayers,CHANNEL_LAYER_MAX_TOTAL);
 assert.deepEqual(result.layerHeightsMm,[0.1,0.2,0.4]);
 assert.ok(close(result.oneSideThicknessMm,0.7),String(result.oneSideThicknessMm));
 assert.ok(close(result.centreBandMm.lowerMm,0.7)&&close(result.centreBandMm.upperMm,9.3)&&close(result.centreBandMm.widthMm,8.6),JSON.stringify(result.centreBandMm));
 const expected=[0,0.1,0.3,0.7,9.3,9.7,9.9,10];
 assert.equal(result.coordinatesMm.length,expected.length);
 result.coordinatesMm.forEach((value,index)=>assert.ok(close(value,expected[index]),String(value)));
 assert.equal(result.coordinatesMm[0],0);
 assert.equal(result.coordinatesMm.at(-1),10);
 result.coordinatesMm.forEach((value,index)=>{if(index)assert.ok(value>result.coordinatesMm[index-1],JSON.stringify(result.coordinatesMm));});
 result.coordinatesMm.forEach((value,index)=>assert.ok(close(value+result.coordinatesMm[result.coordinatesMm.length-1-index],10),String(value)));
 assert.equal(result.layers.length,6);
 const lower=result.layers[0],upper=result.layers[3];
 assert.deepEqual({wallId:lower.wallId,index:lower.index,heightMm:lower.heightMm,innerMm:lower.innerMm,outerMm:lower.outerMm},{wallId:0,index:0,heightMm:0.1,innerMm:0,outerMm:0.1});
 assert.ok(close(lower.distanceFromLowerWallMm,0)&&close(lower.distanceFromUpperWallMm,9.9),JSON.stringify(lower));
 assert.deepEqual({wallId:upper.wallId,index:upper.index,heightMm:upper.heightMm,innerMm:upper.innerMm,outerMm:upper.outerMm},{wallId:1,index:0,heightMm:0.1,innerMm:9.9,outerMm:10});
 assert.ok(close(result.layers[2].distanceFromUpperWallMm,9.3),JSON.stringify(result.layers[2]));
 assert.ok(close(result.walls[0].coordinatesMm[3],0.7)&&close(result.walls[1].coordinatesMm[0],9.3),JSON.stringify(result.walls));
});

test('uniform growth gap 2 mm keeps 0.3 mm per wall and a 1.4 mm centre band',()=>{
 const result=plan({gapMm:2,firstHeightMm:0.1,growthRatio:1,layersPerWall:3});
 assert.deepEqual(result.layerHeightsMm,[0.1,0.1,0.1]);
 assert.ok(close(result.oneSideThicknessMm,0.3)&&close(result.centreBandMm.widthMm,1.4),JSON.stringify(result.centreBandMm));
 assert.equal(result.coordinatesMm.length,8);
 [0,0.1,0.2,0.3,1.7,1.8,1.9,2].forEach((value,index)=>assert.ok(close(result.coordinatesMm[index],value),String(result.coordinatesMm[index])));
 result.coordinatesMm.forEach((value,index)=>{if(index)assert.ok(value>result.coordinatesMm[index-1],JSON.stringify(result.coordinatesMm));});
 assert.ok(close(result.walls[1].coordinatesMm[3],2)&&close(result.walls[1].coordinatesMm[0],1.7),JSON.stringify(result.walls[1].coordinatesMm));
 result.coordinatesMm.forEach((value,index)=>assert.ok(close(value+result.coordinatesMm[result.coordinatesMm.length-1-index],2),String(value)));
});

test('the plan is detached from the caller and never mutates its settings',()=>{
 const settings={gapMm:10,firstHeightMm:0.1,growthRatio:2,layersPerWall:3},before=JSON.stringify(settings);
 const first=plan(settings),second=plan(settings);
 assert.equal(JSON.stringify(settings),before);
 assert.notEqual(first.coordinatesMm,second.coordinatesMm);
 first.coordinatesMm[0]=999;first.layers[0].heightMm=999;
 assert.equal(plan(settings).coordinatesMm[0],0);
 assert.equal(channelLayerPlanScope.meshProduced,false);
 assert.ok(channelLayerPlanScope.unsupported.includes('y-plus'));
 assert.ok(channelLayerPlanScope.unsupported.includes('gmsh-prism-elements'));
});

test('overlap, contact, zero centre width and irresolvable coordinates are refused without reduction',()=>{
 assert.throws(()=>plan({gapMm:1,firstHeightMm:0.2,growthRatio:2,layersPerWall:2}),/contact or cross/);
 assert.throws(()=>plan({gapMm:1,firstHeightMm:0.25,growthRatio:1,layersPerWall:2}),/contact or cross/);
 assert.throws(()=>plan({gapMm:1,firstHeightMm:Number.MIN_VALUE,growthRatio:1,layersPerWall:1}),/non-increasing/);
 assert.throws(()=>plan({gapMm:1e308,firstHeightMm:1e308,growthRatio:1,layersPerWall:2}),/not finite/);
 assert.throws(()=>plan({gapMm:1,firstHeightMm:1e308,growthRatio:2,layersPerWall:2}),/overflows/);
});

test('non-finite, non-positive, sub-unity, fractional and over-budget settings are refused',()=>{
 for(const gapMm of [NaN,Infinity,-1,0])assert.throws(()=>plan({gapMm,firstHeightMm:0.1,growthRatio:2,layersPerWall:3}),/gap/);
 for(const firstHeightMm of [NaN,Infinity,0,-0.1])assert.throws(()=>plan({gapMm:10,firstHeightMm,growthRatio:2,layersPerWall:3}),/First layer/);
 for(const growthRatio of [NaN,Infinity,0.5,0])assert.throws(()=>plan({gapMm:10,firstHeightMm:0.1,growthRatio,layersPerWall:3}),/growth ratio/);
 for(const layersPerWall of [2.5,0,-1,NaN])assert.throws(()=>plan({gapMm:10,firstHeightMm:0.1,growthRatio:2,layersPerWall}),/Layers per wall/);
 assert.throws(()=>plan({gapMm:10,firstHeightMm:0.1,growthRatio:2,layersPerWall:3,maxLayers:5}),/exceeds the maximum/);
 for(const maxLayers of [0,-1,2.5])assert.throws(()=>plan({gapMm:10,firstHeightMm:0.1,growthRatio:2,layersPerWall:3,maxLayers}),/Maximum total layers/);
 assert.throws(()=>plan({gapMm:10,firstHeightMm:0.1,growthRatio:2,layersPerWall:3,unknown:1}),/Unsupported/);
 assert.throws(()=>plan({gapMm:10,firstHeightMm:0.1,growthRatio:2,layersPerWall:3,walls:2}),/Unsupported/);
 assert.throws(()=>plan(),/Unsupported/);
 assert.throws(()=>plan([10,0.1,2,3]),/Unsupported/);
});
