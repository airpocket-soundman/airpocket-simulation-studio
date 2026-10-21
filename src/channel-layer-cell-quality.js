// Pure geometric quality inspection of the axis-aligned hexahedral cells implied
// by a parallel-plate wall-layer coordinate plan. This module only measures cell
// dimensions, volume and edge aspect ratio in millimetres. It does not build a
// Gmsh mesh, does not create Tet4/prism elements, does not solve flow and does
// not compute y+. Every length is in millimetres and is never converted
// implicitly. Inputs are never mutated and the report order is deterministic.
export const channelLayerCellQualityScope=Object.freeze({
 schemaVersion:1,
 kind:'parallel-plate-orthogonal-cell-quality',
 units:{length:'mm',volume:'mm3'},
 output:'orthogonal-cell-geometry-report',
 geometry:'axis-aligned-hex-cells-only',
 meshProduced:false,
 solverConnected:false,
 unsupported:['gmsh-elements','tet4-orientation','tet4-incidence','prism-elements','wall-face-tags','flow-solve','wall-shear-stress','y-plus','general-3d-boundary-layer'],
 deferredChecks:['tet4-orientation-sign','tet4-incidence-consistency','wall-face-tag-retention','gmsh-element-quality']
});
const INPUT_KEYS=Object.freeze(['plan','lengthMm','widthMm','maxAspectRatio','minimumCellHeightMm']);
const RELATIVE_TOLERANCE=1e-12;
/** Compares lengths/thresholds without inventing a coarser tolerance. */
const close=(actual,expected)=>Math.abs(actual-expected)<=RELATIVE_TOLERANCE*Math.max(1,Math.abs(actual),Math.abs(expected));

function positiveLength(value,label){
 if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw Error(label+' must be a positive finite length in mm');
}

/** Validates the retained coordinate plan, both wall identities, the centre band and every wall layer. */
function readPlan(plan){
 if(!plan||typeof plan!=='object'||Array.isArray(plan))throw Error('Channel layer plan must be a coordinate-placement-plan object');
 if(plan.units!=='mm')throw Error('Channel layer plan units must be mm');
 if(plan.output!=='coordinate-placement-plan')throw Error('Channel layer plan output must be coordinate-placement-plan');
 const gapMm=plan.gapMm,layersPerWall=plan.layersPerWall;
 if(!Number.isFinite(gapMm)||gapMm<=0)throw Error('Channel layer plan gap must be a positive finite length in mm');
 if(!Number.isInteger(layersPerWall)||layersPerWall<=0)throw Error('Channel layer plan layersPerWall must be a positive integer');
 const coordinateCount=2*layersPerWall+2;
 if(!Array.isArray(plan.coordinatesMm)||plan.coordinatesMm.length!==coordinateCount)throw Error('Channel layer plan coordinates must contain exactly '+coordinateCount+' increasing coordinates in mm');
 const coordinates=plan.coordinatesMm;
 for(let i=0;i<coordinates.length;i++)if(!Number.isFinite(coordinates[i]))throw Error('Channel layer plan coordinate '+i+' is not a finite length in mm');
 if(coordinates[0]!==0)throw Error('Channel layer plan must start at exactly 0 mm (found '+coordinates[0]+' mm)');
 if(coordinates[coordinates.length-1]!==gapMm)throw Error('Channel layer plan must end at exactly the gap '+gapMm+' mm (found '+coordinates[coordinates.length-1]+' mm)');
 for(let i=1;i<coordinates.length;i++)if(!(coordinates[i]>coordinates[i-1]))throw Error('Channel layer plan coordinates must be strictly increasing; index '+i+' is not greater than its predecessor '+coordinates[i-1]+' mm (duplicate or reversed interval)');
 const walls=plan.walls;
 if(!Array.isArray(walls)||walls.length!==2)throw Error('Channel layer plan must keep exactly two wall identities wallId 0 and wallId 1');
 const lowerWalls=walls.filter(wall=>wall&&wall.wallId===0),upperWalls=walls.filter(wall=>wall&&wall.wallId===1);
 if(lowerWalls.length!==1||upperWalls.length!==1)throw Error('Channel layer plan must keep exactly one wall identity for wallId 0 and one for wallId 1');
 const lowerWall=lowerWalls[0],upperWall=upperWalls[0];
 for(const [wall,wallId] of [[lowerWall,0],[upperWall,1]]){
  if(!Array.isArray(wall.coordinatesMm)||wall.coordinatesMm.length!==layersPerWall+1)throw Error('Wall identity '+wallId+' must keep '+(layersPerWall+1)+' increasing coordinates');
  for(let i=1;i<wall.coordinatesMm.length;i++)if(!(wall.coordinatesMm[i]>wall.coordinatesMm[i-1]))throw Error('Wall identity '+wallId+' coordinates must be strictly increasing');
 }
 if(!close(lowerWall.positionMm,0)||!close(upperWall.positionMm,gapMm))throw Error('Wall identity positions must stay at 0 mm and the '+gapMm+' mm gap');
 for(let i=0;i<=layersPerWall;i++){
  if(!close(lowerWall.coordinatesMm[i],coordinates[i]))throw Error('Lower wall identity coordinate '+i+' does not match the plan coordinates');
  if(!close(upperWall.coordinatesMm[i],coordinates[layersPerWall+1+i]))throw Error('Upper wall identity coordinate '+i+' does not match the plan coordinates');
 }
 const oneSideThickness=coordinates[layersPerWall];
 if(!Number.isFinite(oneSideThickness)||!(oneSideThickness>0))throw Error('One-side wall thickness must be a positive finite length in mm');
 if(!close(plan.oneSideThicknessMm,oneSideThickness))throw Error('Channel layer plan one-side thickness does not match the wall coordinates');
 if(!close(lowerWall.thicknessMm,oneSideThickness)||!close(upperWall.thicknessMm,oneSideThickness))throw Error('Wall identity thickness does not match the wall coordinates');
 const centreBand=plan.centreBandMm;
 if(!centreBand||typeof centreBand!=='object')throw Error('Channel layer plan must report the centre band');
 const centreLowerMm=coordinates[layersPerWall],centreUpperMm=coordinates[layersPerWall+1];
 if(!close(centreBand.lowerMm,centreLowerMm)||!close(centreBand.upperMm,centreUpperMm))throw Error('Centre band identity does not match the plan coordinates');
 if(!Number.isFinite(centreBand.widthMm)||!(centreBand.widthMm>0)||!close(centreBand.widthMm,centreUpperMm-centreLowerMm))throw Error('Centre band width must be positive and equal to its coordinate interval');
 const expectedIntervals=new Map();
 for(let index=0;index<layersPerWall;index++){
  expectedIntervals.set('0:'+index,{innerMm:coordinates[index],outerMm:coordinates[index+1]});
  expectedIntervals.set('1:'+index,{innerMm:coordinates[coordinates.length-2-index],outerMm:coordinates[coordinates.length-1-index]});
 }
 const layerCount=2*layersPerWall;
 if(!Array.isArray(plan.layers)||plan.layers.length!==layerCount)throw Error('Channel layer plan must list exactly '+layerCount+' wall layers');
 const seen=new Set();
 for(let i=0;i<plan.layers.length;i++){
  const layer=plan.layers[i];
  if(!layer||typeof layer!=='object')throw Error('Channel layer plan layer '+i+' is not a wall layer object');
  if(layer.wallId!==0&&layer.wallId!==1)throw Error('Channel layer plan layer '+i+' wallId must be 0 or 1');
  if(!Number.isInteger(layer.index)||layer.index<0||layer.index>=layersPerWall)throw Error('Channel layer plan layer '+i+' wallId '+layer.wallId+' index is outside 0..'+(layersPerWall-1));
  const key=layer.wallId+':'+layer.index;
  if(seen.has(key))throw Error('Channel layer plan layer '+i+' duplicates wallId '+layer.wallId+' layer index '+layer.index);
  seen.add(key);
  const interval=expectedIntervals.get(key);
  if(!interval)throw Error('Channel layer plan layer '+i+' wallId '+layer.wallId+' index '+layer.index+' has no matching cell interval');
  if(!close(layer.innerMm,interval.innerMm)||!close(layer.outerMm,interval.outerMm))throw Error('Channel layer plan layer '+i+' (wallId '+layer.wallId+', index '+layer.index+') interval does not match the wall coordinates');
  if(!close(layer.heightMm,interval.outerMm-interval.innerMm))throw Error('Channel layer plan layer '+i+' height does not match its coordinate interval');
 }
 if(seen.size!==expectedIntervals.size)throw Error('Channel layer plan is missing wall layer intervals');
 return {gapMm,layersPerWall,coordinates,centreLowerMm,centreUpperMm};
}

/** Reports one axis-aligned cell per adjacent y interval of the retained plan.
 * Wall cells keep the plan wallId and layer index; the centre band is reported
 * separately. Threshold violations throw with the concrete cell index and never
 * drop layers or relax the requested limits.
 */
export function createChannelLayerCellQuality(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Unsupported channel layer cell quality setting');
 for(const key of INPUT_KEYS)if(!Object.hasOwn(input,key))throw Error('Unsupported channel layer cell quality setting: missing '+key);
 if(Object.keys(input).some(key=>!INPUT_KEYS.includes(key)))throw Error('Unsupported channel layer cell quality setting');
 const {plan,lengthMm,widthMm,maxAspectRatio,minimumCellHeightMm}=input;
 positiveLength(lengthMm,'Channel length');
 positiveLength(widthMm,'Channel width');
 if(typeof maxAspectRatio!=='number'||!Number.isFinite(maxAspectRatio)||maxAspectRatio<1)throw Error('Maximum aspect ratio must be a finite number >= 1');
 if(typeof minimumCellHeightMm!=='number'||!Number.isFinite(minimumCellHeightMm)||minimumCellHeightMm<=0)throw Error('Minimum cell height must be a positive finite length in mm');
 const {gapMm,layersPerWall,coordinates,centreLowerMm,centreUpperMm}=readPlan(plan);
 const cells=[];let totalVolume=0,minimumObservedHeight=Infinity,maximumObservedAspect=0;
 for(let index=0;index<coordinates.length-1;index++){
  const lowerYMm=coordinates[index],upperYMm=coordinates[index+1];
  const heightMm=upperYMm-lowerYMm;
  if(!Number.isFinite(heightMm)||!(heightMm>0))throw Error('Cell '+index+' height is not a positive finite length in mm');
  const volumeMm3=lengthMm*widthMm*heightMm;
  if(!Number.isFinite(volumeMm3)||!(volumeMm3>0))throw Error('Cell '+index+' volume is not a positive finite value in mm3 (length*width*height overflow)');
  const shortestEdgeMm=Math.min(lengthMm,widthMm,heightMm),longestEdgeMm=Math.max(lengthMm,widthMm,heightMm);
  if(!Number.isFinite(shortestEdgeMm)||!(shortestEdgeMm>0)||!Number.isFinite(longestEdgeMm))throw Error('Cell '+index+' edge lengths are not positive and finite');
  const aspectRatio=longestEdgeMm/shortestEdgeMm;
  if(!Number.isFinite(aspectRatio))throw Error('Cell '+index+' aspect ratio is not finite');
  const region=index<layersPerWall?'lower-wall':index===layersPerWall?'centre':'upper-wall';
  const wallId=region==='centre'?null:region==='lower-wall'?0:1;
  const layerIndex=region==='lower-wall'?index:region==='upper-wall'?coordinates.length-2-index:null;
  if(minimumCellHeightMm-heightMm>RELATIVE_TOLERANCE*Math.max(1,minimumCellHeightMm))throw Error('Cell '+index+' height '+heightMm+' mm is below the minimum cell height '+minimumCellHeightMm+' mm');
  if(aspectRatio-maxAspectRatio>RELATIVE_TOLERANCE*Math.max(1,aspectRatio,maxAspectRatio))throw Error('Cell '+index+' aspect ratio '+aspectRatio+' exceeds the maximum aspect ratio '+maxAspectRatio);
  totalVolume+=volumeMm3;
  minimumObservedHeight=Math.min(minimumObservedHeight,heightMm);
  maximumObservedAspect=Math.max(maximumObservedAspect,aspectRatio);
  cells.push({index,region,wallId,layerIndex,lowerYMm,upperYMm,heightMm,lengthMm,widthMm,volumeMm3,shortestEdgeMm,longestEdgeMm,aspectRatio});
 }
 if(!Number.isFinite(totalVolume)||!(totalVolume>0))throw Error('Total cell volume is not a positive finite value in mm3');
 const expectedVolumeMm3=lengthMm*widthMm*gapMm;
 if(!Number.isFinite(expectedVolumeMm3)||!(expectedVolumeMm3>0))throw Error('Expected channel volume length*width*gap is not a positive finite value in mm3 (product overflow)');
 const relativeVolumeError=Math.abs(totalVolume-expectedVolumeMm3)/Math.abs(expectedVolumeMm3);
 if(!Number.isFinite(relativeVolumeError)||relativeVolumeError>RELATIVE_TOLERANCE)throw Error('Total cell volume '+totalVolume+' mm3 does not match length*width*gap '+expectedVolumeMm3+' mm3 (relative error '+relativeVolumeError+')');
 return {
  units:'mm',volumeUnits:'mm3',output:'orthogonal-cell-geometry-report',status:'checked',
  gapMm,lengthMm,widthMm,maxAspectRatio,minimumCellHeightMm,layersPerWall,totalLayerCount:2*layersPerWall,cellCount:cells.length,
  cells,
  centreBandMm:{lowerMm:centreLowerMm,upperMm:centreUpperMm,widthMm:centreUpperMm-centreLowerMm},
  minimumObservedHeightMm:minimumObservedHeight,maximumObservedAspectRatio:maximumObservedAspect,
  totalVolumeMm3:totalVolume,expectedVolumeMm3,relativeVolumeError,
  scope:structuredClone(channelLayerCellQualityScope)
 };
}
