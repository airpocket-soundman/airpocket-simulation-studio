import {createChannelLayerCellQuality} from './channel-layer-cell-quality.js';
import {tetraVolume} from './tetra-geometry.js';

// 512 wall layers plus one centre cell; callers cannot raise these hard caps.
export const CHANNEL_TET4_MAX_WALL_LAYERS=512;
export const CHANNEL_TET4_MAX_NODES=4*(CHANNEL_TET4_MAX_WALL_LAYERS+2);
export const CHANNEL_TET4_MAX_ELEMENTS=6*(CHANNEL_TET4_MAX_WALL_LAYERS+1);
const tolerance=1e-12;
const faces=([a,b,c,d])=>[[b,c,d],[a,d,c],[a,b,d],[a,c,b]];
const parity=face=>{let sign=1;for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(face[i]>face[j])sign=-sign;return sign;};
const triangleArea=(nodes,face)=>{
 const [a,b,c]=face.map(id=>nodes.slice(3*id,3*id+3));
 const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);
 return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
};

/** Strict read-only validation for this limited axis-aligned box, not a general mesh gate. */
export function inspectChannelLayerTet4(mesh){
 const {nodes,tetrahedra,lengthMm,widthMm,gapMm}=mesh??{};
 if(mesh?.units!=='mm')throw Error('Tet4 units must be mm');
 if(mesh?.output!=='limited-channel-tet4')throw Error('Unsupported Tet4 output');
 if(Array.isArray(nodes)&&nodes.length>3*CHANNEL_TET4_MAX_NODES||Array.isArray(tetrahedra)&&tetrahedra.length>CHANNEL_TET4_MAX_ELEMENTS)throw Error('Tet4 capacity exceeded');
 if(![lengthMm,widthMm,gapMm].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0))throw Error('Invalid finite channel dimensions');
 if(!Array.isArray(nodes)||nodes.length%3||!nodes.length||!nodes.every(v=>typeof v==='number'&&Number.isFinite(v)))throw Error('Invalid finite nodes');
 const positions=new Set();
 for(let id=0;id<nodes.length/3;id++){
  const p=nodes.slice(id*3,id*3+3),key=p.join(',');
  if(positions.has(key))throw Error('Duplicate geometric node');positions.add(key);
  if(p.some((v,i)=>v<0||v>[lengthMm,gapMm,widthMm][i]))throw Error('Node outside channel');
 }
 if(!Array.isArray(tetrahedra)||!tetrahedra.length)throw Error('Missing Tet4 elements');
 const incidence=new Map(),seen=new Set();let totalVolumeMm3=0;
 for(const tet of tetrahedra){
  if(!Array.isArray(tet)||tet.length!==4||new Set(tet).size!==4||!tet.every(i=>Number.isInteger(i)&&i>=0&&i<nodes.length/3))throw Error('Invalid Tet4 connectivity');
  const key=[...tet].sort((a,b)=>a-b).join(',');if(seen.has(key))throw Error('Duplicate Tet4');seen.add(key);
  const volume=tetraVolume(nodes,tet);if(!Number.isFinite(volume)||volume<=0)throw Error('Tet4 must have positive finite signed volume');totalVolumeMm3+=volume;
  for(const face of faces(tet)){
   const key=[...face].sort((a,b)=>a-b).join(',');
   if(!incidence.has(key))incidence.set(key,[]);incidence.get(key).push(face);
  }
 }
 const boundaryFaces=[];let internalFaceCount=0;const areas={lowerWall:0,upperWall:0,xMin:0,xMax:0,zMin:0,zMax:0};
 const planes=[[1,0,'lowerWall'],[1,gapMm,'upperWall'],[0,0,'xMin'],[0,lengthMm,'xMax'],[2,0,'zMin'],[2,widthMm,'zMax']];
 for(const entries of incidence.values()){
  if(entries.length===2){if(parity(entries[0])===parity(entries[1]))throw Error('Internal face orientation mismatch');internalFaceCount++;continue;}
  if(entries.length!==1)throw Error('Nonmanifold face incidence');
  const face=entries[0],plane=planes.find(([axis,value])=>face.every(id=>nodes[id*3+axis]===value));
  if(!plane)throw Error('Nonconforming face or interior gap');
  const tag=plane[2],areaMm2=triangleArea(nodes,face);if(!Number.isFinite(areaMm2)||areaMm2<=0)throw Error('Invalid boundary area');
  areas[tag]+=areaMm2;boundaryFaces.push({nodes:[...face],tag,wallId:tag==='lowerWall'?0:tag==='upperWall'?1:null,areaMm2});
 }
 const expectedVolumeMm3=lengthMm*widthMm*gapMm,relativeVolumeError=Math.abs(totalVolumeMm3-expectedVolumeMm3)/expectedVolumeMm3;
 if(!Number.isFinite(relativeVolumeError)||relativeVolumeError>tolerance)throw Error('Tet4 volume mismatch');
 const expectedAreas={lowerWall:lengthMm*widthMm,upperWall:lengthMm*widthMm,xMin:gapMm*widthMm,xMax:gapMm*widthMm,zMin:gapMm*lengthMm,zMax:gapMm*lengthMm};
 for(const tag of Object.keys(areas))if(!Number.isFinite(areas[tag])||!Number.isFinite(expectedAreas[tag])||Math.abs(areas[tag]-expectedAreas[tag])/expectedAreas[tag]>tolerance)throw Error('Boundary area mismatch: '+tag);
 return {totalVolumeMm3,expectedVolumeMm3,relativeVolumeError,internalFaceCount,boundaryFaces,areasMm2:areas};
}

/** Six Freudenthal tetrahedra per retained orthogonal cell share global plane nodes. */
export function createChannelLayerTet4(input){
 const plan=input?.plan;
 // Reject an oversized declared or retained plan before the quality reader allocates maps/cells.
 if(plan&&(plan.layersPerWall>CHANNEL_TET4_MAX_WALL_LAYERS/2||Array.isArray(plan.coordinatesMm)&&plan.coordinatesMm.length>CHANNEL_TET4_MAX_WALL_LAYERS+2||Array.isArray(plan.layers)&&plan.layers.length>CHANNEL_TET4_MAX_WALL_LAYERS))throw Error('Tet4 plan capacity exceeded');
 const quality=createChannelLayerCellQuality(input);
 const {lengthMm,widthMm,gapMm}=quality;
 const ys=[quality.cells[0].lowerYMm,...quality.cells.map(c=>c.upperYMm)],nodes=[],tetrahedra=[];
 // Plane ordering is (x,z)=(0,0),(L,0),(0,W),(L,W).
 for(const y of ys)for(const [x,z] of [[0,0],[lengthMm,0],[0,widthMm],[lengthMm,widthMm]])nodes.push(x,y,z);
 const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
 for(let cell=0;cell<quality.cellCount;cell++)for(const order of permutations){
  const bits=[0,0,0],id=()=>4*(cell+bits[1])+bits[0]+2*bits[2],tet=[id()];
  for(const axis of order){bits[axis]=1;tet.push(id());}
  if(tetraVolume(nodes,tet)<0)[tet[1],tet[2]]=[tet[2],tet[1]];
  tetrahedra.push(tet);
 }
 const mesh={units:'mm',output:'limited-channel-tet4',lengthMm,widthMm,gapMm,nodes,tetrahedra};
 return {...mesh,inspection:inspectChannelLayerTet4(mesh),scope:{solverConnected:false,gmshConnected:false,unsupported:['general-3d-boundary-layer','flow-solve','y-plus','solver-wall-tags']}};
}
