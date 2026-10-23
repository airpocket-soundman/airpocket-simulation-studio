import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChannelLayerPlan} from '../src/channel-layer-plan.js';
import {createChannelLayerCellQuality,channelLayerCellQualityScope} from '../src/channel-layer-cell-quality.js';

const close=(actual,expected,tolerance=1e-12)=>Math.abs(actual-expected)<=tolerance;
const basePlan=()=>createChannelLayerPlan({gapMm:10,firstHeightMm:0.1,growthRatio:2,layersPerWall:3});
const baseInput=()=>({plan:basePlan(),lengthMm:2,widthMm:1,maxAspectRatio:20,minimumCellHeightMm:0.1});
const quality=(input=baseInput())=>createChannelLayerCellQuality(input);
const clone=value=>structuredClone(value);

test('minimum height is relative even far below one millimetre',()=>{
 const input={plan:createChannelLayerPlan({gapMm:1e-9,firstHeightMm:1e-14,growthRatio:1,layersPerWall:1}),lengthMm:1e-9,widthMm:1e-9,maxAspectRatio:100001,minimumCellHeightMm:5e-13};
 const before=clone(input);assert.throws(()=>quality(input),/below the minimum/);assert.deepEqual(input,before);
 input.minimumCellHeightMm=1e-14;assert.equal(quality(input).cellCount,3);
});

test('reference plan yields seven 2x1 mm cells with the documented heights, volumes and aspects',()=>{
 const report=quality();
 assert.equal(report.units,'mm');
 assert.equal(report.volumeUnits,'mm3');
 assert.equal(report.output,'orthogonal-cell-geometry-report');
 assert.equal(report.status,'checked');
 assert.equal(report.layersPerWall,3);
 assert.equal(report.totalLayerCount,6);
 assert.equal(report.cellCount,7);
 assert.equal(report.cells.length,7);
 const heights=[0.1,0.2,0.4,8.6,0.4,0.2,0.1],volumes=[0.2,0.4,0.8,17.2,0.8,0.4,0.2];
 report.cells.forEach((cell,index)=>{
  assert.equal(cell.index,index);
  assert.ok(close(cell.lowerYMm,[0,0.1,0.3,0.7,9.3,9.7,9.9][index]),JSON.stringify(cell));
  assert.ok(close(cell.heightMm,heights[index]),JSON.stringify(cell));
  assert.equal(cell.lengthMm,2);
  assert.equal(cell.widthMm,1);
  assert.ok(close(cell.volumeMm3,volumes[index]),JSON.stringify(cell));
 });
 assert.deepEqual(report.cells.map(cell=>cell.region),['lower-wall','lower-wall','lower-wall','centre','upper-wall','upper-wall','upper-wall']);
 assert.deepEqual(report.cells.map(cell=>cell.wallId),[0,0,0,null,1,1,1]);
 assert.deepEqual(report.cells.map(cell=>cell.layerIndex),[0,1,2,null,2,1,0]);
 const thinnest=report.cells[0];
 assert.ok(close(thinnest.shortestEdgeMm,0.1)&&close(thinnest.longestEdgeMm,2),JSON.stringify(thinnest));
 assert.ok(close(thinnest.aspectRatio,20),String(thinnest.aspectRatio));
 const centre=report.cells[3];
 assert.ok(close(centre.shortestEdgeMm,1)&&close(centre.longestEdgeMm,8.6),JSON.stringify(centre));
 assert.ok(close(centre.aspectRatio,8.6),String(centre.aspectRatio));
 assert.ok(close(report.totalVolumeMm3,20),String(report.totalVolumeMm3));
 assert.ok(close(report.expectedVolumeMm3,20),String(report.expectedVolumeMm3));
 assert.ok(report.relativeVolumeError<=1e-12,String(report.relativeVolumeError));
 assert.ok(close(report.minimumObservedHeightMm,0.1)&&close(report.maximumObservedAspectRatio,20),JSON.stringify(report));
 assert.ok(close(report.centreBandMm.lowerMm,0.7)&&close(report.centreBandMm.upperMm,9.3)&&close(report.centreBandMm.widthMm,8.6),JSON.stringify(report.centreBandMm));
 assert.equal(report.scope.meshProduced,false);
 assert.equal(report.scope.solverConnected,false);
 for(const term of ['tet4-orientation','tet4-incidence','wall-face-tags','gmsh-elements','flow-solve','y-plus'])assert.ok(report.scope.unsupported.includes(term),term);
 for(const term of ['tet4-orientation-sign','tet4-incidence-consistency','wall-face-tag-retention'])assert.ok(report.scope.deferredChecks.includes(term),term);
 assert.ok(channelLayerCellQualityScope.deferredChecks.includes('gmsh-element-quality'));
});

test('height and aspect thresholds are inclusive at the measured boundary and name the failing cell',()=>{
 assert.equal(quality({...baseInput(),maxAspectRatio:20}).cells.length,7);
 assert.throws(()=>quality({...baseInput(),maxAspectRatio:19.9}),/Cell 0 aspect ratio/);
 assert.equal(quality({...baseInput(),minimumCellHeightMm:0.1}).cells.length,7);
 assert.throws(()=>quality({...baseInput(),minimumCellHeightMm:0.11}),/Cell 0 height .* below the minimum cell height 0\.11/);
 // Only the centre band violates this limit: walls are 1/0.1=10 and the centre is 8.6/0.5=17.2.
 assert.throws(()=>quality({...baseInput(),lengthMm:1,widthMm:0.5,maxAspectRatio:10}),/Cell 3 aspect ratio 17\.2/);
 // A refused report never reduces the plan: the same plan still yields all 7 cells at the documented limits.
 const plan=basePlan(),refused=()=>{try{quality({plan,lengthMm:2,widthMm:1,maxAspectRatio:19.9,minimumCellHeightMm:0.1});}catch{return true;}return false;};
 assert.equal(refused(),true);
 const relaxed=quality({plan,lengthMm:2,widthMm:1,maxAspectRatio:20,minimumCellHeightMm:0.1});
 assert.equal(relaxed.cellCount,7);
 assert.equal(relaxed.totalLayerCount,6);
 assert.deepEqual(plan,basePlan());
});

test('zero, negative, non-finite and non-numeric lengths and thresholds are refused',()=>{
 for(const lengthMm of [0,-1,NaN,Infinity,-Infinity,'2'])assert.throws(()=>quality({...baseInput(),lengthMm}),/Channel length must be a positive finite length in mm/);
 for(const widthMm of [0,-1,NaN,Infinity,-Infinity,'1'])assert.throws(()=>quality({...baseInput(),widthMm}),/Channel width must be a positive finite length in mm/);
 for(const maxAspectRatio of [0,-1,0.5,NaN,Infinity,-Infinity,'20'])assert.throws(()=>quality({...baseInput(),maxAspectRatio}),/Maximum aspect ratio must be a finite number >= 1/);
 for(const minimumCellHeightMm of [0,-0.1,NaN,Infinity,-Infinity,'0.1'])assert.throws(()=>quality({...baseInput(),minimumCellHeightMm}),/Minimum cell height must be a positive finite length in mm/);
 for(const key of ['plan','lengthMm','widthMm','maxAspectRatio','minimumCellHeightMm']){const input=baseInput();delete input[key];assert.throws(()=>quality(input),/missing/);}
 assert.throws(()=>quality({...baseInput(),extra:1}),/Unsupported channel layer cell quality setting/);
 assert.throws(()=>createChannelLayerCellQuality(),/Unsupported channel layer cell quality setting/);
 assert.throws(()=>quality([basePlan(),2,1,20,0.1]),/Unsupported channel layer cell quality setting/);
});

test('plan coordinate arrays must be finite, strictly increasing and end exactly at the gap',()=>{
 const tamper=mutate=>{const plan=basePlan();mutate(plan);return ()=>quality({...baseInput(),plan});};
 const duplicate=tamper(plan=>{plan.coordinatesMm[3]=plan.coordinatesMm[2];});
 assert.throws(duplicate,/strictly increasing|duplicate or reversed/);
 const reversed=tamper(plan=>{[plan.coordinatesMm[2],plan.coordinatesMm[3]]=[plan.coordinatesMm[3],plan.coordinatesMm[2]];});
 assert.throws(reversed,/strictly increasing|duplicate or reversed/);
 const endpoint=tamper(plan=>{plan.coordinatesMm[7]=9.99;});
 assert.throws(endpoint,/end at exactly the gap 10 mm|9\.99/);
 const nonfinite=tamper(plan=>{plan.coordinatesMm[2]=NaN;});
 assert.throws(nonfinite,/coordinate 2 is not a finite length/);
 const missing=tamper(plan=>{plan.coordinatesMm.splice(2,1);});
 assert.throws(missing,/exactly 8 increasing coordinates/);
 const gapMismatch=tamper(plan=>{plan.gapMm=9.99;});
 assert.throws(gapMismatch,/end at exactly the gap 9\.99 mm|one-side thickness/);
 const units=tamper(plan=>{plan.units='m';});
 assert.throws(units,/units must be mm/);
 const output=tamper(plan=>{plan.output='coordinate-placement-plan-draft';});
 assert.throws(output,/output must be coordinate-placement-plan/);
 const badLayersPerWall=tamper(plan=>{plan.layersPerWall=2;});
 assert.throws(badLayersPerWall,/exactly 6 increasing coordinates|layersPerWall/);
});

test('wall identity, layer wallId/index and centre band tampering are refused',()=>{
 const tamper=mutate=>{const plan=basePlan();mutate(plan);return ()=>quality({...baseInput(),plan});};
 assert.throws(tamper(plan=>{plan.layers[0].wallId=1;}),/duplicates wallId 1|wallId/);
 assert.throws(tamper(plan=>{plan.layers[1].index=9;}),/index is outside 0\.\.2/);
 assert.throws(tamper(plan=>{plan.layers[0].index=2;plan.layers[2].index=0;}),/interval does not match|duplicates/);
 assert.throws(tamper(plan=>{plan.walls[0].coordinatesMm[1]=0.2;}),/Lower wall identity coordinate 1 does not match/);
 assert.throws(tamper(plan=>{plan.walls[0].wallId=2;}),/exactly one wall identity/);
 assert.throws(tamper(plan=>{plan.walls.pop();}),/exactly two wall identities/);
 assert.throws(tamper(plan=>{plan.centreBandMm.lowerMm=0.71;}),/Centre band identity does not match/);
 assert.throws(tamper(plan=>{plan.centreBandMm.widthMm=0;}),/Centre band width must be positive/);
 assert.throws(tamper(plan=>{plan.layers[0].innerMm=0.01;}),/interval does not match/);
 assert.throws(tamper(plan=>{plan.layers.pop();}),/exactly 6 wall layers/);
 assert.throws(tamper(plan=>{plan.layers[0].heightMm=0.05;}),/height does not match/);
 assert.throws(tamper(plan=>{plan.oneSideThicknessMm=0.5;}),/one-side thickness does not match/);
 assert.throws(tamper(plan=>{plan.walls[1].thicknessMm=0.5;}),/thickness does not match/);
});

test('retained wall, layer and centre metadata require finite numbers without coercion',()=>{
 const paths=[['oneSideThicknessMm'],['centreBandMm','lowerMm'],['centreBandMm','upperMm'],['centreBandMm','widthMm']];
 const plan=basePlan();
 for(let wall=0;wall<plan.walls.length;wall++){
  paths.push(['walls',wall,'positionMm'],['walls',wall,'thicknessMm']);
  for(let coordinate=0;coordinate<plan.walls[wall].coordinatesMm.length;coordinate++)paths.push(['walls',wall,'coordinatesMm',coordinate]);
 }
 for(let layer=0;layer<plan.layers.length;layer++)for(const key of ['innerMm','outerMm','heightMm'])paths.push(['layers',layer,key]);
 for(const path of paths){
  const parent=path.slice(0,-1).reduce((value,key)=>value[key],plan),key=path.at(-1),original=parent[key];
  for(const invalid of [Infinity,-Infinity,NaN,String(original),null,false,undefined]){
   const changed=clone(plan),target=path.slice(0,-1).reduce((value,key)=>value[key],changed);target[key]=invalid;
   assert.throws(()=>quality({...baseInput(),plan:changed}),undefined,path.join('.')+' must reject '+String(invalid));
  }
 }
 assert.equal(quality({...baseInput(),plan}).totalVolumeMm3,20,'valid numeric metadata retains the reference volume');
});

test('finite factors whose product is not finite are refused as overflow',()=>{
 assert.throws(()=>quality({...baseInput(),lengthMm:1e200,widthMm:1e200}),/volume is not a positive finite value|overflow/);
 assert.throws(()=>quality({...baseInput(),lengthMm:1e308,widthMm:10}),/volume is not a positive finite value|overflow/);
 assert.throws(()=>quality({...baseInput(),lengthMm:1e308,widthMm:1,maxAspectRatio:1e308}),/aspect ratio is not finite/);
 // Every cell volume stays finite; only the accumulated total overflows.
 const side=Math.sqrt(1.9e307);
 assert.throws(()=>quality({...baseInput(),lengthMm:side,widthMm:side,maxAspectRatio:1e156}),/Total cell volume is not a positive finite value|overflow/);
});

test('inputs are not mutated, output is detached, ordering is deterministic and JSON roundtrips',()=>{
 const input=baseInput(),before=JSON.stringify(input),planBefore=JSON.stringify(input.plan);
 const first=quality(input),second=quality(input);
 assert.equal(JSON.stringify(input),before);
 assert.equal(JSON.stringify(input.plan),planBefore);
 assert.deepEqual(first,second);
 assert.notEqual(first.cells,second.cells);
 assert.notEqual(first.cells[0],second.cells[0]);
 assert.notEqual(first.scope,channelLayerCellQualityScope);
 first.cells[0].volumeMm3=999;first.cells[3].region='tampered';first.minimumObservedHeightMm=999;
 assert.equal(quality(input).cells[0].volumeMm3,baseInput().lengthMm*baseInput().widthMm*0.1);
 assert.equal(quality(input).cells[3].region,'centre');
 assert.ok(close(quality(input).minimumObservedHeightMm,0.1));
 const roundtrip=JSON.parse(JSON.stringify(first));
 assert.deepEqual(roundtrip,first);
 assert.deepEqual(JSON.parse(JSON.stringify(roundtrip)),roundtrip);
 for(const value of [first.totalVolumeMm3,first.expectedVolumeMm3,first.relativeVolumeError,first.minimumObservedHeightMm,first.maximumObservedAspectRatio])assert.ok(Number.isFinite(value),String(value));
 for(const cell of first.cells)for(const key of ['lowerYMm','upperYMm','heightMm','lengthMm','widthMm','volumeMm3','shortestEdgeMm','longestEdgeMm','aspectRatio'])assert.ok(Number.isFinite(cell[key]),key);
 const jsonPlan=JSON.parse(JSON.stringify(basePlan()));
 assert.deepEqual(quality({...baseInput(),plan:jsonPlan}),quality());
});
