import {sourceFingerprint} from './source-identity.js';
import {validateFluidDomain,enclosureBounds,validateSphere} from './fluid-domain.js';
export function tetraVolume(nodes,t){const p=t.map(i=>nodes.slice(i*3,i*3+3)),a=p[1].map((v,i)=>v-p[0][i]),b=p[2].map((v,i)=>v-p[0][i]),c=p[3].map((v,i)=>v-p[0][i]);return (a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}
export function inspectMesh(mesh){
 if(!Array.isArray(mesh.nodes)||mesh.nodes.length%3||!mesh.nodes.every(Number.isFinite)||!Array.isArray(mesh.tetrahedra)||!mesh.tetrahedra.length)throw Error('Invalid volume mesh');
 let volume=0,minVolume=Infinity;
 for(const t of mesh.tetrahedra){if(t.length!==4||new Set(t).size!==4||!t.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.nodes.length/3))throw Error('Invalid tetrahedron');let v=tetraVolume(mesh.nodes,t);if(Math.abs(v)<1e-15)throw Error('Degenerate tetrahedron');if(v<0){[t[0],t[1]]=[t[1],t[0]];v=-v;}volume+=v;minVolume=Math.min(minVolume,v);}
 const qualityHistogram=Array(5).fill(0);if(mesh.qualities){if(mesh.qualities.length!==mesh.tetrahedra.length||!mesh.qualities.every(Number.isFinite))throw Error('Invalid mesh quality data');for(const q of mesh.qualities)qualityHistogram[Math.max(0,Math.min(4,Math.floor(q*5)))]++;}
 return {nodeCount:mesh.nodes.length/3,elementCount:mesh.tetrahedra.length,volumeMm3:volume,minVolumeMm3:minVolume,minQuality:mesh.qualities?.length?Math.min(...mesh.qualities):null,qualityHistogram};
}
export async function generateMesh(initialize,source,{size=5,refinements=[],maxElements=30000}={}){
 const sourceHash=await sourceFingerprint(source);
 if(source.kind==='boxes'){if(!Array.isArray(source.boxes)||!source.boxes.length||source.boxes.length>10||source.boxes.some(b=>!Array.isArray(b)||b.length!==6||!b.every(Number.isFinite)||b.slice(3).some(v=>v<=0)))throw Error('Invalid independent box solids');for(let i=0;i<source.boxes.length;i++)for(let j=0;j<i;j++)if([0,1,2].every(k=>Math.min(source.boxes[i][k]+source.boxes[i][k+3],source.boxes[j][k]+source.boxes[j][k+3])>Math.max(source.boxes[i][k],source.boxes[j][k])+1e-9))throw Error('Independent box solids cannot overlap in volume');const mesh={sourceHash,nodes:[],tetrahedra:[],surface:[],qualities:[],nodeBodies:[],size,engine:'Gmsh WASM 0.3.0 / independent solids'};for(const [bodyIndex,bounds]of source.boxes.entries()){const part=await generateMesh(initialize,{kind:'box',bounds},{size,refinements,maxElements}),offset=mesh.nodes.length/3;mesh.nodes.push(...part.nodes);mesh.nodeBodies.push(...Array(part.nodes.length/3).fill(bodyIndex));mesh.tetrahedra.push(...part.tetrahedra.map(t=>t.map(i=>i+offset)));mesh.surface.push(...part.surface.map(f=>({...f,nodes:f.nodes.map(i=>i+offset),bodyIndex})));mesh.qualities.push(...part.qualities);if(mesh.tetrahedra.length>maxElements)throw Error('Assembly element limit exceeded; increase mesh size');}mesh.summary=inspectMesh(mesh);return mesh;}

 if(!Number.isFinite(size)||size<=0)throw Error('Mesh size must be positive');if(!Array.isArray(refinements)||refinements.length>1000||refinements.some(r=>!Array.isArray(r.center)||r.center.length!==3||!r.center.every(Number.isFinite)||!Number.isFinite(r.radius)||r.radius<=0||!Number.isFinite(r.size)||r.size<size*.15||r.size>size))throw Error('Local mesh size must be between 15% and 100% of global size, with a positive radius');
 const logs=[];const gmsh=await initialize({print:s=>logs.push(s),printErr:s=>logs.push(s)});gmsh.initialize();
 try{
 gmsh.option.setNumber('General.Terminal',0);gmsh.option.setNumber('General.NumThreads',1);gmsh.option.setNumber('Mesh.MeshSizeMin',refinements.length?size*.15:size);gmsh.option.setNumber('Mesh.MeshSizeMax',size);gmsh.option.setNumber('Mesh.ElementOrder',1);gmsh.option.setNumber('Mesh.MeshSizeFromCurvature',12);gmsh.model.add('analysis');
 const solid=source.kind==='fluidDomain'?validateFluidDomain(source).solid:source;
 if(solid.kind==='step'){gmsh.option.setString('Geometry.OCCTargetUnit','MM');const bytes=Uint8Array.from(atob(solid.data),c=>c.charCodeAt(0));gmsh.FS.writeFile('/model.step',bytes);gmsh.model.occ.importShapes('/model.step');}
 else if(solid.kind==='cylinder')gmsh.model.occ.addCylinder(0,-30,0,0,60,0,12);
 else if(solid.kind==='box')gmsh.model.occ.addBox(...solid.bounds);
 else if(solid.kind==='sphere'){validateSphere(solid);gmsh.model.occ.addSphere(...solid.center,solid.radius);}
 else if(solid.kind==='boxes')for(const bounds of solid.boxes)gmsh.model.occ.addBox(...bounds);
 else throw Error('Volume meshing currently requires STEP or a built-in solid');
 if(source.kind==='fluidDomain'){
  gmsh.model.occ.synchronize();const tools=gmsh.model.getEntities(3).dimTags||gmsh.model.getEntities(3);if(!tools.length)throw Error('No solid volume to subtract from fluid enclosure');const bbox=gmsh.model.getBoundingBox(-1,-1),b=enclosureBounds(source.enclosure);if(source.enclosure.kind==='sphere'){const sphere=source.enclosure;let maxDistance=0;for(let corner=0;corner<8;corner++)maxDistance=Math.max(maxDistance,Math.hypot(...[0,1,2].map(k=>bbox[(corner&(1<<k))?['xmax','ymax','zmax'][k]:['xmin','ymin','zmin'][k]]-sphere.center[k])));if(maxDistance>=sphere.radius-1e-6)throw Error('Acoustic sphere must contain the original CAD bounding box with a positive gap');}if([0,1,2].some(k=>b[k]>=bbox[['xmin','ymin','zmin'][k]]-1e-6||b[k]+b[k+3]<=bbox[['xmax','ymax','zmax'][k]]+1e-6))throw Error('Fluid enclosure must completely contain the original solid with a positive gap');
  const tag=source.enclosure.kind==='sphere'?gmsh.model.occ.addSphere(...source.enclosure.center,source.enclosure.radius):gmsh.model.occ.addBox(...b),cut=gmsh.model.occ.cut([3,tag],tools,-1,true,true);if(!cut.outDimTags?.length)throw Error('No fluid volume remains after subtraction');gmsh.model.occ.synchronize();
  const enclosed=[];for(let i=0;i<cut.outDimTags.length;i+=2){const volume=gmsh.model.getBoundingBox(3,cut.outDimTags[i+1]);if([0,1,2].every(k=>volume[['xmin','ymin','zmin'][k]]>b[k]+1e-6&&volume[['xmax','ymax','zmax'][k]]<b[k]+b[k+3]-1e-6))enclosed.push(3,cut.outDimTags[i+1]);}
  if(enclosed.length){gmsh.model.occ.remove(enclosed,true);gmsh.model.occ.synchronize();}
 }
 gmsh.model.occ.synchronize();const volumes=gmsh.model.getEntities(3).dimTags||gmsh.model.getEntities(3);if(!volumes.length)throw Error('No solid volume found');
 const bounds=gmsh.model.getBoundingBox(-1,-1),estimate=6*(bounds.xmax-bounds.xmin)*(bounds.ymax-bounds.ymin)*(bounds.zmax-bounds.zmin)/size**3;if(estimate>maxElements*4)throw Error('Requested mesh is too fine for the browser limit; increase mesh size');
 if(refinements.length)gmsh.model.mesh.setSizeCallback((_dim,_tag,x,y,z,lc)=>{let h=Math.min(lc,size);for(const r of refinements){const d=Math.hypot(x-r.center[0],y-r.center[1],z-r.center[2]);if(d<r.radius)h=Math.min(h,r.size+(size-r.size)*d/r.radius);}return h;});
 gmsh.model.mesh.generate(3);
 const n=gmsh.model.mesh.getNodes(),index=new Map(n.nodeTags.map((tag,i)=>[tag,i])),e=gmsh.model.mesh.getElements(3),tetrahedra=[],tags=[];
 for(let k=0;k<e.elementTypes.length;k++){if(e.elementTypes[k]!==4)throw Error('Unsupported volume element type');for(let i=0;i<e.nodeTags[k].length;i+=4)tetrahedra.push(e.nodeTags[k].slice(i,i+4).map(tag=>index.get(tag)));tags.push(...e.elementTags[k]);}
 if(tetrahedra.length>maxElements)throw Error('Element limit exceeded; increase mesh size');
 const surface=[],entities=gmsh.model.getEntities(2).dimTags||gmsh.model.getEntities(2);
 for(let i=0;i<entities.length;i+=2){const tag=entities[i+1],s=gmsh.model.mesh.getElements(2,tag);for(let k=0;k<s.elementTypes.length;k++){if(s.elementTypes[k]!==2)continue;for(let j=0;j<s.nodeTags[k].length;j+=3)surface.push({nodes:s.nodeTags[k].slice(j,j+3).map(t=>index.get(t)),faceTag:tag});}}
 const mesh={sourceHash,nodes:n.coord,tetrahedra,surface,qualities:gmsh.model.mesh.getElementQualities(tags,'minSICN').elementsQuality,size,engine:'Gmsh WASM 0.3.0'};mesh.summary=inspectMesh(mesh);return mesh;
 }catch(e){throw Error(e.message+(logs.length?' · '+logs.slice(-2).join(' / '):''));}finally{gmsh.finalize();}
}


