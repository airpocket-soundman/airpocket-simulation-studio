import {MAX_MESH_DIAGNOSTICS} from './mesh-validity.js';

// Analytic CAD faces of the primitive sources that mesh-core.js builds; must match its OCC calls.
const CYLINDER={radius:12,yMin:-30,yMax:30};
const clampOut=(v,lo,hi)=>v<lo?lo-v:v>hi?v-hi:0;
const boxFaces=(b,body)=>{const lo=b.slice(0,3),hi=[0,1,2].map(k=>b[k]+b[k+3]),out=[];
 for(let k=0;k<3;k++)for(const side of [0,1]){const c=side?hi[k]:lo[k],o=[0,1,2].filter(j=>j!==k);
  out.push({id:`box${body}:${'xyz'[k]}${side?'max':'min'}`,kind:'plane',areaMm2:b[o[0]+3]*b[o[1]+3],distance:p=>Math.hypot(p[k]-c,clampOut(p[o[0]],lo[o[0]],hi[o[0]]),clampOut(p[o[1]],lo[o[1]],hi[o[1]]))});}
 return out;};
/** Analytic bounded CAD faces for a mesh-core primitive source, or null when unsupported. */
export function analyticCadFaces(source){
 const kind=source?.kind;
 if(kind==='box'&&Array.isArray(source.bounds)&&source.bounds.length===6)return boxFaces(source.bounds,0);
 if(kind==='boxes'&&Array.isArray(source.boxes))return source.boxes.flatMap((b,i)=>boxFaces(b,i));
 if(kind==='sphere'&&Array.isArray(source.center)){const {center:c,radius:R}=source;return [{id:'sphere',kind:'sphere',areaMm2:4*Math.PI*R*R,distance:p=>Math.abs(Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2])-R)}];}
 if(kind==='cylinder'){const {radius:R,yMin,yMax}=CYLINDER,r=p=>Math.hypot(p[0],p[2]);
  return [{id:'cylinder:lateral',kind:'cylinder',areaMm2:2*Math.PI*R*(yMax-yMin),distance:p=>Math.hypot(r(p)-R,clampOut(p[1],yMin,yMax))},
   {id:'cylinder:ymin',kind:'plane',areaMm2:Math.PI*R*R,distance:p=>Math.hypot(p[1]-yMin,Math.max(0,r(p)-R))},
   {id:'cylinder:ymax',kind:'plane',areaMm2:Math.PI*R*R,distance:p=>Math.hypot(p[1]-yMax,Math.max(0,r(p)-R))}];}
 return null;
}

/** Read-only check that every surface node lies on the analytic CAD face its faceTag maps to,
 * within toleranceMm. Each (bodyIndex, faceTag) group is matched to the face with fewest out-of-tolerance nodes;
 * also reports the chordal sag of triangle centroids (informational). Never modifies the mesh. */
export function analyzeSurfaceCadDistance(mesh,source,{toleranceMm}={}){
 const nodes=mesh?.nodes,surface=mesh?.surface;
 if(!(Array.isArray(nodes)||ArrayBuffer.isView(nodes))||!Array.isArray(surface))throw Error('CAD distance check requires nodes and surface arrays');
 const faces=analyticCadFaces(source);
 if(!faces)return {supported:false,conforming:null,sourceKind:source?.kind??null,diagnostics:[],faceTags:[],cadFaces:[],truncated:false};
 const nodeCount=nodes.length/3,point=i=>[nodes[3*i],nodes[3*i+1],nodes[3*i+2]];
 let extent=0;for(let i=0;i<nodes.length;i++)extent=Math.max(extent,Math.abs(nodes[i]));
 const tol=toleranceMm??1e-6*Math.max(1,extent);
 if(!Number.isFinite(tol)||tol<=0)throw Error('CAD distance tolerance must be positive');
 const byTag=new Map();
 for(let s=0;s<surface.length;s++){const f=surface[s]?.nodes,tag=surface[s]?.faceTag,body=surface[s]?.bodyIndex;
  if(!Array.isArray(f)||f.length!==3||!f.every(i=>Number.isInteger(i)&&i>=0&&i<nodeCount))throw Error('Invalid surface triangle '+s);
  if(!Number.isInteger(tag))throw Error('Surface triangle '+s+' has no faceTag; run analyzeBoundaryFaceAssignment first');
  const key=(Number.isInteger(body)?body:'')+':'+tag;(byTag.get(key)??byTag.set(key,{faceTag:tag,bodyIndex:Number.isInteger(body)?body:null,tris:[]}).get(key)).tris.push(f);}
 const diagnostics=[],counts={deviation:0,unmatched:0,uncovered:0,shared:0};
 const push=(code,message,evidence)=>{counts[code]++;if(diagnostics.length<MAX_MESH_DIAGNOSTICS)diagnostics.push({code:'MESH_CAD_'+code.toUpperCase(),severity:'error',message,evidence});};
 const faceTags=[],covered=new Map();
 for(const {faceTag:tag,bodyIndex,tris}of byTag.values()){
  const ids=[...new Set(tris.flat())];
  let best=null;for(const face of faces){let worst=0,at=-1,off=0;for(const i of ids){const d=face.distance(point(i));if(d>tol)off++;if(d>worst){worst=d;at=i;}}if(!best||off<best.off||(off===best.off&&worst<best.maxNodeDistanceMm))best={face,maxNodeDistanceMm:worst,worstNode:at,off};}
  let sag=0;for(const f of tris){const p=[0,1,2].map(k=>(nodes[3*f[0]+k]+nodes[3*f[1]+k]+nodes[3*f[2]+k])/3);sag=Math.max(sag,best.face.distance(p));}
  const row={faceTag:tag,bodyIndex,cadFace:best.face.id,cadKind:best.face.kind,nodes:ids.length,nodesOutsideTolerance:best.off,triangles:tris.length,maxNodeDistanceMm:best.maxNodeDistanceMm,maxCentroidSagMm:sag};
  faceTags.push(row);
  if(best.maxNodeDistanceMm>tol){const most=2*best.off>ids.length;push(most?'unmatched':'deviation',most?'Surface faceTag does not lie on any CAD face':'Surface node is farther from its CAD face than the tolerance',{faceTag:tag,bodyIndex,cadFace:best.face.id,nodesOutsideTolerance:best.off,node:best.worstNode,distanceMm:best.maxNodeDistanceMm,toleranceMm:tol});continue;}
  const prev=covered.get(best.face.id);
  if(prev!==undefined)push('shared','Two faceTags map to the same CAD face',{cadFace:best.face.id,faceTags:[prev,{faceTag:tag,bodyIndex}]});else covered.set(best.face.id,{faceTag:tag,bodyIndex});
 }
 for(const face of faces)if(!covered.has(face.id))push('uncovered','CAD face has no surface triangles mapped to it',{cadFace:face.id});
 return {supported:true,conforming:diagnostics.length===0&&Object.values(counts).every(n=>n===0),sourceKind:source.kind,toleranceMm:tol,counts,faceTags,
  cadFaces:faces.map(f=>({id:f.id,kind:f.kind,areaMm2:f.areaMm2,faceTag:covered.get(f.id)??null})),diagnostics,truncated:Object.values(counts).reduce((a,b)=>a+b,0)>diagnostics.length};
}
