// Explicit finite-enclosure half-space caps; not CAD opening-wire recognition.
// Caller supplies outward unit normals. Retained fluid satisfies n.(x-point) <= 0.
const vector=v=>Array.isArray(v)&&v.length===3&&Array.from(v).every(Number.isFinite);
export const openingCapDistance=(cap,point)=>cap.normal.reduce((s,v,k)=>s+v*(point[k]-cap.point[k]),0);
export function validateOpeningCaps(source){
 const caps=source.openingCaps;if(caps===undefined)return;
 const b=source.enclosure;
 if(source.mode!=='internal'||!Array.isArray(b)||!Array.isArray(caps)||caps.length<1||caps.length>6)throw Error('Opening caps require 1–6 explicit internal half-space planes');
 const ids=new Set(),diagonal=Math.hypot(...b.slice(3)),extent=4*diagonal;
 if(!Number.isFinite(4*extent)||!b.slice(0,3).every((v,k)=>Number.isFinite(v+b[k+3])))throw Error('Opening cap enclosure exceeds numerical limits');
 for(const cap of caps){
  if(!cap||typeof cap!=='object'||Array.isArray(cap)||Object.keys(cap).some(k=>!['id','point','normal'].includes(k))||typeof cap.id!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(cap.id)||ids.has(cap.id)||!vector(cap.point)||!vector(cap.normal)||Math.abs(Math.hypot(...cap.normal)-1)>1e-8)throw Error('Opening caps require unique IDs, finite points and explicit unit outward normals');
  ids.add(cap.id);
  if(cap.point.some((v,k)=>v<b[k]||v>b[k]+b[k+3]||!Number.isFinite(v-4*extent)||!Number.isFinite(v+4*extent))||!vector(source.seedPoint)||!Number.isFinite(openingCapDistance(cap,source.seedPoint))||openingCapDistance(cap,source.seedPoint)>=-1e-6)throw Error('Opening cap must retain the seed strictly on its inward side');
  const distances=Array.from({length:8},(_,corner)=>openingCapDistance(cap,b.slice(0,3).map((v,k)=>v+((corner&(1<<k))?b[k+3]:0))));
  if(!distances.every(Number.isFinite)||Math.min(...distances)>=-1e-6||Math.max(...distances)<=1e-6)throw Error('Opening cap must cut through the enclosure');
 }
 for(let i=0;i<caps.length;i++)for(let j=0;j<i;j++)if(caps[i].normal.every((v,k)=>Math.abs(v-caps[j].normal[k])<1e-8)&&Math.abs(openingCapDistance(caps[i],caps[j].point))<1e-6)throw Error('Duplicate opening cap plane');
}
/** Clip the convex enclosure, then let the existing CAD-solid subtraction select
 * the one seed-connected component. No multiple-volume union is inferred. */
export function clipOpeningCaps(g,tag,source){
 validateOpeningCaps(source);
 for(const cap of source.openingCaps??[]){
  const length=4*Math.hypot(...source.enclosure.slice(3)),norm=Math.hypot(...cap.normal),n=cap.normal.map(v=>v/norm),transverse=Math.hypot(n[0],n[1]);
  // Rigid transforms preserve OCC planar surface types. The accepted unit normal
  // is used for construction only; never rewrite the caller's saved normal.
  const tool=g.model.occ.addBox(-length,-length,0,2*length,2*length,length);
  if(transverse>0)g.model.occ.rotate([3,tool],0,0,0,-n[1],n[0],0,Math.atan2(transverse,n[2]));
  else if(n[2]<0)g.model.occ.rotate([3,tool],0,0,0,1,0,0,Math.PI);
  g.model.occ.translate([3,tool],...cap.point);
  const cut=g.model.occ.cut([3,tag],[3,tool],-1,true,true).outDimTags;
  if(!Array.isArray(cut)||cut.length!==2||cut[0]!==3)throw Error('Opening caps must retain exactly one convex enclosure volume');tag=cut[1];
 }
 return tag;
}
export function capForCadFace(g,faceTag,caps){
 if(!caps?.length||g.model.getType(2,faceTag).entityType!=='Plane')return;
 const c=g.model.occ.getCenterOfMass(2,faceTag),point=[c.x,c.y,c.z],parameters=g.model.getParametrization(2,faceTag,point).parametricCoord,normal=g.model.getNormal(faceTag,parameters).normals;
 if(!vector(normal))throw Error('Invalid opening cap CAD normal');
 const matches=caps.filter(cap=>Math.abs(openingCapDistance(cap,point))<1e-6&&Math.abs(Math.abs(normal.reduce((s,v,k)=>s+v*cap.normal[k],0))-1)<1e-7);
 if(matches.length>1)throw Error('Ambiguous opening cap CAD face');return matches[0];
}

/** New cap results require a complete single connected Tet4 boundary. This does
 * not reclassify historical box-port archives or infer a fluid-volume union. */
export function validateCappedBoundary(mesh){
 const tets=mesh.tetrahedra,n=mesh.nodes.length/3;
 if(!Array.isArray(tets)||!tets.length||tets.length>30000||mesh.surface.length>120000)throw Error('Invalid capped fluid tetrahedra');
 const key=ids=>[...ids].sort((a,b)=>a-b).join(','),faces=new Map(),neighbors=Array.from({length:tets.length},()=>[]);
 for(const [e,t]of tets.entries()){
  if(!Array.isArray(t)||t.length!==4||new Set(t).size!==4||!Array.from(t).every(i=>Number.isInteger(i)&&i>=0&&i<n))throw Error('Invalid capped fluid tetrahedron');
  for(let opposite=0;opposite<4;opposite++){
   const k=key(t.filter((_,i)=>i!==opposite)),owners=faces.get(k)??[];owners.push(e);if(owners.length>2)throw Error('Nonmanifold capped fluid mesh');faces.set(k,owners);
   if(owners.length===2){neighbors[e].push(owners[0]);neighbors[owners[0]].push(e);}
  }
 }
 const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const e of neighbors[queue[i]])if(!seen.has(e)){seen.add(e);queue.push(e);}if(seen.size!==tets.length)throw Error('Capped fluid mesh must be one connected volume');
 const boundary=new Set([...faces].filter(([,owners])=>owners.length===1).map(([k])=>k));
 for(const f of mesh.surface){if(!Array.isArray(f.nodes)||f.nodes.length!==3||new Set(f.nodes).size!==3||!boundary.delete(key(f.nodes)))throw Error('Capped fluid surface does not match its tetrahedral boundary');}
 if(boundary.size)throw Error('Capped fluid surface boundary is incomplete');
}
