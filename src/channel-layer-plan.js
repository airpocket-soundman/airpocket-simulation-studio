// Pure wall-layer placement planning for a parallel-plate channel. This is a
// coordinate plan only: it does not build a Gmsh prism/tet mesh, does not solve
// flow and does not compute y+. Every length is in millimetres and is never
// converted implicitly. Inputs are never mutated.
export const CHANNEL_LAYER_MAX_TOTAL=512;
export const channelLayerPlanScope=Object.freeze({
 schemaVersion:1,
 kind:'parallel-plate-wall-layer-placement',
 units:{length:'mm'},
 output:'coordinate-placement-plan',
 meshProduced:false,
 unsupported:['gmsh-prism-elements','tetrahedral-mesh','flow-solve','y-plus','wall-shear-stress','general-3d-boundary-layer','moving-walls']
});
const SETTINGS=Object.freeze(['gapMm','firstHeightMm','growthRatio','layersPerWall','maxLayers']);

/** Geometric layer heights h_i = h0*r^i for one wall, rejecting overflow and non-positive heights. */
function layeringHeights(firstHeightMm,growthRatio,layersPerWall){
 const heights=[];
 let height=firstHeightMm;
 for(let i=0;i<layersPerWall;i++){
  if(!Number.isFinite(height)||height<=0)throw Error('Wall layer height overflows at index '+i+' for growth ratio '+growthRatio);
  heights.push(height);
  if(i+1<layersPerWall){height*=growthRatio;}
 }
 return heights;
}

/** Place identical layers on both walls of a parallel-plate gap.
 * The lower wall sits at y=0, the upper wall at y=gapMm; both walls share the
 * same first height and growth ratio, so the plan is mirror symmetric. The
 * unlayered centre band is reported explicitly and must keep a positive width
 * (contact and crossing are refused rather than reduced or normalised).
 * Returned coordinates are strictly increasing and keep the exact endpoints 0
 * and gapMm. Future meshing must retain a wall id on every layer face and must
 * check added tetrahedra for inversion; neither is connected in this unit.
 */
export function createChannelLayerPlan(settings){
 if(!settings||typeof settings!=='object'||Array.isArray(settings)||Object.keys(settings).some(key=>!SETTINGS.includes(key)))throw Error('Unsupported channel layer plan setting');
 const {gapMm,firstHeightMm,growthRatio,layersPerWall,maxLayers=CHANNEL_LAYER_MAX_TOTAL}=settings;
 if(!Number.isFinite(gapMm)||gapMm<=0)throw Error('Channel gap must be a positive finite length in mm');
 if(!Number.isFinite(firstHeightMm)||firstHeightMm<=0)throw Error('First layer height must be a positive finite length in mm');
 if(!Number.isFinite(growthRatio)||growthRatio<1)throw Error('Layer growth ratio must be a finite number >= 1');
 if(!Number.isInteger(layersPerWall)||layersPerWall<=0)throw Error('Layers per wall must be a positive integer');
 if(!Number.isInteger(maxLayers)||maxLayers<1)throw Error('Maximum total layers must be a positive integer');
 if(2*layersPerWall>maxLayers)throw Error('Total layer count '+2*layersPerWall+' exceeds the maximum of '+maxLayers);
 const heights=layeringHeights(firstHeightMm,growthRatio,layersPerWall);
 const lowerCoordinates=[0];
 let thickness=0;
 for(const height of heights){
  thickness+=height;
  if(!Number.isFinite(thickness))throw Error('Accumulated wall layer thickness is not finite');
  lowerCoordinates.push(thickness);
 }
 const centreWidth=gapMm-2*thickness;
 if(!Number.isFinite(centreWidth)||centreWidth<=0)throw Error('Wall layers contact or cross: one-side thickness '+thickness+' mm leaves no positive centre width in a '+gapMm+' mm gap');
 const upperCoordinates=lowerCoordinates.slice().reverse().map(coordinate=>gapMm-coordinate);
 const coordinates=[];
 for(const coordinate of lowerCoordinates.concat(upperCoordinates)){
  if(coordinates.length&&!(coordinate>coordinates[coordinates.length-1]))throw Error('Layer placement produces a non-increasing coordinate at '+coordinate+' mm; the requested heights are not resolvable in a '+gapMm+' mm gap');
  coordinates.push(coordinate);
 }
 const layers=[];
 for(const wallId of [0,1])for(let index=0;index<layersPerWall;index++){
  const lower=lowerCoordinates[index],upper=lowerCoordinates[index+1];
  layers.push({wallId,index,heightMm:heights[index],innerMm:wallId===0?lower:gapMm-upper,outerMm:wallId===0?upper:gapMm-lower,distanceFromLowerWallMm:wallId===0?lower:gapMm-upper,distanceFromUpperWallMm:wallId===0?gapMm-upper:lower});
 }
 return {
  units:'mm',
  output:'coordinate-placement-plan',
  gapMm,firstHeightMm,growthRatio,layersPerWall,maxLayers,
  layerHeightsMm:heights.slice(),
  oneSideThicknessMm:thickness,
  centreBandMm:{lowerMm:thickness,upperMm:gapMm-thickness,widthMm:centreWidth},
  coordinatesMm:coordinates,
  totalLayerCount:layers.length,
  walls:[
   {wallId:0,positionMm:0,thicknessMm:thickness,heightsMm:heights.slice(),coordinatesMm:lowerCoordinates.slice()},
   {wallId:1,positionMm:gapMm,thicknessMm:thickness,heightsMm:heights.slice(),coordinatesMm:upperCoordinates.slice()}
  ],
  layers,
  scope:structuredClone(channelLayerPlanScope)
 };
}
