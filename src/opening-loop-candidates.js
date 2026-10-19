/** Opening-loop candidate detection on an indexed triangle surface.
 *
 * This is candidate detection over a triangle mesh only. It is NOT STEP/OCC arbitrary
 * wire recognition, NOT local lid generation and NOT fluid coupling. It never connects
 * to source/API/UI/Worker code and its output must be confirmed by a caller.
 *
 * Input: {nodes:number[] flat x,y,z (mm, indexed), triangles:number[][] (node indices),
 *         toleranceMm:number (>0, mm)}. The caller's arrays are copied, never mutated.
 *
 * Output: {status:'checked', toleranceMm, nodeCount, triangleCount, boundaryEdgeCount,
 *   closedShell:boolean, candidates:[...], rejected:[...]}.
 *   candidate = {id, nodeIndices (original ids, canonical cycle), pointsMm,
 *                plane:{pointMm,normal,residualMm}, normal, outward:'undetermined',
 *                areaMm2, perimeterMm, convex, triangleIndices}
 *   rejected  = {code, nodeIndices, detail?} for shapes that are not accepted (so a
 *                closed shell with no boundary is distinguished from a malformed one).
 *
 * Only undirected edges with incidence 1 are boundary edges. Node identity is preserved
 * exactly: coincident coordinates under distinct ids are never welded, they are refused
 * as an unresolved seam. The plane normal sign follows the canonical cycle, so the
 * physical outward direction is reported as undetermined. Throws on malformed input
 * (non-finite/missing coordinates, invalid or repeated triangle vertices, non-positive
 * or non-finite toleranceMm).
 */
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const scale=v=>Math.max(1,...v.map(x=>Math.abs(x)));
function newell(pts){
 let nx=0,ny=0,nz=0;
 for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];nx+=(a[1]-b[1])*(a[2]+b[2]);ny+=(a[2]-b[2])*(a[0]+b[0]);nz+=(a[0]-b[0])*(a[1]+b[1]);}
 return [nx,ny,nz];
}
const cmpIndex=a=>b=>{for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return a[i]-b[i];return a.length-b.length;};
function rotations(cycle){
 const out=[];
 for(let i=0;i<cycle.length;i++)out.push(cycle.slice(i).concat(cycle.slice(0,i)));
 return out;
}
export function extractOpeningLoopCandidates(input){
 const nodes=input?.nodes,triangles=input?.triangles,toleranceMm=input?.toleranceMm;
 if(!Array.isArray(nodes)||!nodes.length||nodes.length%3)throw Error('Opening loop extraction requires indexed x,y,z node coordinates');
 if(!Array.from(nodes).every(finite))throw Error('Opening loop extraction requires finite node coordinates in mm');
 if(!finite(toleranceMm)||toleranceMm<=0)throw Error('Opening loop extraction requires a positive finite toleranceMm');
 if(!Array.isArray(triangles)||!triangles.length)throw Error('Opening loop extraction requires a triangle array');
 const nodeCount=nodes.length/3,points=Array.from({length:nodeCount},(_,i)=>[nodes[3*i],nodes[3*i+1],nodes[3*i+2]]);
 const tri=triangles.map((t,i)=>{
  if(!Array.isArray(t)||t.length!==3||new Set(t).size!==3||!t.every(v=>Number.isInteger(v)&&v>=0&&v<nodeCount))throw Error('Invalid opening triangle vertices at index '+i);
  return [t[0],t[1],t[2]];
 });
 // Undirected edge incidence. incidence>2 is a non-manifold edge; only incidence 1 is a boundary.
 const edges=new Map();
 for(let i=0;i<tri.length;i++){const t=tri[i];
  for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],lo=Math.min(a,b),hi=Math.max(a,b),key=lo+':'+hi,e=edges.get(key)??{a:lo,b:hi,count:0,triangleIndices:[]};e.count++;e.triangleIndices.push(i);edges.set(key,e);}
 }
 const rejected=[],boundary=[];
 for(const e of edges.values()){if(e.count===1)boundary.push(e);else if(e.count>2)rejected.push({code:'OPENING_LOOP_NONMANIFOLD_EDGE',nodeIndices:[e.a,e.b],detail:'edge incidence '+e.count});}
 const neighbors=new Map();
 for(const e of boundary)for(const [v,w] of [[e.a,e.b],[e.b,e.a]]){const s=neighbors.get(v)??new Set();s.add(w);neighbors.set(v,s);}
 // Exact-coordinate duplicate detection only: no distance welding, but an un-welded seam is refused.
 const byCoord=new Map();
 for(const v of neighbors.keys()){const k=points[v].join(','),arr=byCoord.get(k)??[];arr.push(v);byCoord.set(k,arr);}
 const seamVertices=new Set();
 for(const arr of byCoord.values())if(arr.length>1)for(const v of arr)seamVertices.add(v);
 const candidates=[],visited=new Set();
 for(const seed of [...neighbors.keys()].sort((a,b)=>a-b)){
  if(visited.has(seed))continue;
  const component=new Set([seed]),stack=[seed];
  while(stack.length){const x=stack.pop();for(const y of neighbors.get(x))if(!component.has(y)){component.add(y);stack.push(y);}}
  for(const v of component)visited.add(v);
  const branchy=[...component].filter(v=>neighbors.get(v).size!==2).sort((a,b)=>a-b);
  if(branchy.length){rejected.push({code:'OPENING_LOOP_BOUNDARY_BRANCH',nodeIndices:branchy,detail:'boundary degree is not 2'});continue;}
  const start=Math.min(...component),cycle=[start];
  let prev=null,cur=start,repeated=false;
  for(;;){
   const ns=[...neighbors.get(cur)].sort((a,b)=>a-b),next=ns.find(n=>n!==prev)??ns[0];
   if(next===start)break;
   if(cycle.includes(next)){repeated=true;break;}
   cycle.push(next);prev=cur;cur=next;
  }
  if(repeated){rejected.push({code:'OPENING_LOOP_REPEATED_VERTEX',nodeIndices:cycle,detail:'boundary walk repeats a vertex'});continue;}
  const seam=[...cycle].filter(v=>seamVertices.has(v)).sort((a,b)=>a-b);
  if(seam.length){rejected.push({code:'OPENING_LOOP_UNWELDED_SEAM',nodeIndices:seam,detail:'coincident coordinates use distinct node ids'});continue;}
  const canonical=[...rotations(cycle),...rotations([...cycle].reverse())].sort(cmpIndex)[0];
  const pts=canonical.map(i=>points[i]),nv=newell(pts),len=Math.hypot(nv[0],nv[1],nv[2]);
  if(!finite(len)||!(len>0)){rejected.push({code:'OPENING_LOOP_DEGENERATE',nodeIndices:canonical,detail:'zero or non-finite loop area'});continue;}
  const normal=nv.map(v=>v/len),areaMm2=len/2,centroid=[0,1,2].map(k=>pts.reduce((s,p)=>s+p[k],0)/pts.length);
  const residualMm=Math.max(...pts.map(p=>Math.abs((p[0]-centroid[0])*normal[0]+(p[1]-centroid[1])*normal[1]+(p[2]-centroid[2])*normal[2])));
  if(!finite(residualMm)||residualMm>toleranceMm){rejected.push({code:'OPENING_LOOP_NONPLANAR',nodeIndices:canonical,detail:'plane residual '+residualMm+' mm exceeds toleranceMm'});continue;}
  const axis=[0,1,2].reduce((best,k)=>Math.abs(normal[k])<Math.abs(normal[best])?k:best,0),e=[0,0,0];e[axis]=1;
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const uRaw=cross(normal,e),ulen=Math.hypot(...uRaw),u=uRaw.map(w=>w/ulen),v=cross(normal,u);
  const project=(p,w)=>(p[0]-centroid[0])*w[0]+(p[1]-centroid[1])*w[1]+(p[2]-centroid[2])*w[2];
  const flat=pts.map(p=>[project(p,u),project(p,v)]);
  const n=flat.length;
  let twiceArea=0,perimeterMm=0;
  for(let i=0;i<n;i++){const a=flat[i],b=flat[(i+1)%n];twiceArea+=a[0]*b[1]-b[0]*a[1];perimeterMm+=Math.hypot(b[0]-a[0],b[1]-a[1]);}
  const orientation=Math.sign(twiceArea)||1,eps=1e-9*scale(flat.flat());
  let convex=true;
  for(let i=0;i<n&&convex;i++){const a=flat[i],b=flat[(i+1)%n],c=flat[(i+2)%n],sign=((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))*orientation;if(sign<-eps)convex=false;}
  const side=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  let selfIntersecting=false;
  for(let i=0;i<n&&!selfIntersecting;i++)for(let j=i+1;j<n;j++){
   if(j===i+1||(i===0&&j===n-1))continue;
   const p1=flat[i],p2=flat[(i+1)%n],p3=flat[j],p4=flat[(j+1)%n],d1=side(p3,p4,p1),d2=side(p3,p4,p2),d3=side(p1,p2,p3),d4=side(p1,p2,p4);
   if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0))){selfIntersecting=true;break;}
  }
  if(selfIntersecting){rejected.push({code:'OPENING_LOOP_SELF_INTERSECTING',nodeIndices:canonical,detail:'boundary polygon crosses itself'});continue;}
  const triangleIndices=[...new Set(boundary.filter(be=>component.has(be.a)&&component.has(be.b)).flatMap(be=>be.triangleIndices))].sort((a,b)=>a-b);
  candidates.push({id:'loop:'+canonical.join(','),nodeIndices:canonical,pointsMm:pts.map(p=>[...p]),plane:{pointMm:[...centroid],normal:[...normal],residualMm},normal:[...normal],outward:'undetermined',areaMm2,perimeterMm,convex,triangleIndices});
 }
 candidates.sort((a,b)=>cmpIndex(a.nodeIndices)(b.nodeIndices));
 return {status:'checked',toleranceMm,nodeCount,triangleCount:tri.length,boundaryEdgeCount:boundary.length,closedShell:boundary.length===0,candidates,rejected};
}
