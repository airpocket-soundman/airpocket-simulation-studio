// Headless rigid-body-mode check for static linear structural input.
// Pure: reads only the retained mesh and the transferred boundary records (`fixed`, `displacements`
// as produced by transferConditions) and never mutates them.
//
// Method. For each connected solid component, every nodal constraint n.u(x)=c (fixed = three axis
// constraints, displacement = one constraint along its normalised direction) restricts a rigid
// motion u(x)=t+w x x to the linear row [n, x x n] over the six rigid parameters [t, w]. Coordinates
// are taken relative to the component centroid and divided by the component's maximum radius so
// translations and rotations are commensurate. The numerical rank of the constraint matrix C is
// obtained from the eigen-decomposition (cyclic Jacobi) of the 6x6 Gram matrix C^T C; a singular value is
// counted only when sigma > RANK_RELATIVE_TOLERANCE * sigma_max (i.e. eigenvalue > tol^2 * lambda_max).
// Near-degenerate layouts therefore err towards "free". Prescribed (non-zero) displacements constrain
// exactly like zero ones. Springs / elastic supports are not modelled by the transfer, so they can never
// be counted as eliminating a mode.
export const RANK_RELATIVE_TOLERANCE=1e-6;
export const FREE_MODE_PARTICIPATION=1e-8;
export const RIGID_BODY_MODES=Object.freeze([
 {mode:'translation-x',kind:'translation',axis:'x'},{mode:'translation-y',kind:'translation',axis:'y'},{mode:'translation-z',kind:'translation',axis:'z'},
 {mode:'rotation-x',kind:'rotation',axis:'x'},{mode:'rotation-y',kind:'rotation',axis:'y'},{mode:'rotation-z',kind:'rotation',axis:'z'}]);
const describe=(m)=>m.kind==='translation'?`translation along the ${m.axis} axis is not constrained`:`rotation about the ${m.axis} axis is not constrained`;
const identity=[[1,0,0],[0,1,0],[0,0,1]];

function jacobiEigen(matrix){
 const n=6,a=matrix.map(row=>[...row]),v=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
 for(let sweep=0;sweep<60;sweep++){
  let off=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)off+=a[i][j]*a[i][j];
  if(off<1e-30)break;
  for(let p=0;p<n;p++)for(let q=p+1;q<n;q++){
   if(Math.abs(a[p][q])<1e-300)continue;
   const theta=(a[q][q]-a[p][p])/(2*a[p][q]),t=Math.sign(theta||1)/(Math.abs(theta)+Math.sqrt(theta*theta+1)),c=1/Math.sqrt(t*t+1),s=t*c;
   for(let k=0;k<n;k++){const kp=a[k][p],kq=a[k][q];a[k][p]=c*kp-s*kq;a[k][q]=s*kp+c*kq;}
   for(let k=0;k<n;k++){const pk=a[p][k],qk=a[q][k];a[p][k]=c*pk-s*qk;a[q][k]=s*pk+c*qk;}
   for(let k=0;k<n;k++){const kp=v[k][p],kq=v[k][q];v[k][p]=c*kp-s*kq;v[k][q]=s*kp+c*kq;}
  }
 }
 return {values:a.map((row,i)=>row[i]),vectors:Array.from({length:n},(_,j)=>v.map(row=>row[j]))};
}

/** Rank of a list of 6-vectors (constraint rows) with the documented relative tolerance. Exposed for tests. */
export function rigidConstraintRank(rows){
 const gram=Array.from({length:6},()=>Array(6).fill(0));
 for(const r of rows)for(let i=0;i<6;i++)for(let j=0;j<6;j++)gram[i][j]+=r[i]*r[j];
 const {values,vectors}=jacobiEigen(gram),max=Math.max(...values,0);
 const free=[];let rank=0;
 values.forEach((value,i)=>{if(max>0&&value>RANK_RELATIVE_TOLERANCE**2*max)rank++;else free.push(vectors[i]);});
 return {rank,nullSpace:free,largestSingularValue:Math.sqrt(max)};
}

function unavailable(){return {code:'ANALYSIS_RIGID_BODY_CHECK_UNAVAILABLE',severity:'warning',stage:'constraint-rank',target:'/job',message:'Rigid-body constraint rank could not be evaluated from the retained mesh and transferred boundaries',evidence:{},suggestions:['Re-run the mesh-only job and inspect the retained mesh'],requiresUserIntent:false};}
const notChecked=(status,reason,extra={})=>({status,rigidBodyModesEliminated:false,freeRigidModeCount:null,modes:RIGID_BODY_MODES.map(m=>({...m,status:status==='not-applicable'?'not-applicable':'unknown',description:reason})),components:[],reason,...extra});

export function analyzeRigidBodyConstraints({project,mesh,boundary,components}={}){
 const study=project?.study??{};
 if((study.kind!==undefined&&study.kind!=='structural')||study.modalAnalysis===true)return {...notChecked('not-applicable','Rigid-body constraint rank applies to static structural analysis only (thermal, acoustic, flow and modal studies are not covered)'),diagnostics:[]};
 if(!mesh||!(Array.isArray(mesh.nodes)||ArrayBuffer.isView(mesh.nodes))||mesh.nodes.length%3!==0)return {...notChecked('unknown','Retained mesh has no usable node coordinates; rigid-body modes could not be checked'),diagnostics:[unavailable()]};
 const nodeCount=mesh.nodes.length/3;
 let groups=components;
 if(!groups){
  if(Array.isArray(mesh.tetrahedra)&&mesh.tetrahedra.length){
   const parent=Array.from({length:nodeCount},(_,i)=>i),root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},used=new Set();
   for(const t of mesh.tetrahedra)for(const i of t){if(!Number.isInteger(i)||i<0||i>=nodeCount)return {...notChecked('unknown','Retained mesh connectivity is invalid; rigid-body modes could not be checked'),diagnostics:[unavailable()]};used.add(i);parent[root(i)]=root(t[0]);}
   const map=new Map();for(const i of [...used].sort((a,b)=>a-b)){const r=root(i);if(!map.has(r))map.set(r,[]);map.get(r).push(i);}groups=[...map.values()];
  }else groups=[];
 }
 if(!groups.length)return {...notChecked('unknown','Retained mesh contains no solid elements; rigid-body modes could not be checked'),diagnostics:[unavailable()]};
 const records=new Map(),add=(node,direction)=>{if(!Number.isInteger(node)||node<0||node>=nodeCount||!Array.isArray(direction)||direction.length!==3||!direction.every(Number.isFinite))return false;const norm=Math.hypot(...direction);if(norm<1e-12)return false;if(!records.has(node))records.set(node,[]);records.get(node).push(direction.map(v=>v/norm));return true;};
 let invalid=0;
 for(const node of boundary?.fixed??[])for(const axis of identity)if(!add(node,axis))invalid++;
 for(const r of boundary?.displacements??[])if(!add(r.node,r.direction))invalid++;
 if(invalid)return {...notChecked('unknown','Transferred constraint records are invalid; rigid-body modes could not be checked',{invalidConstraintRecords:invalid}),diagnostics:[unavailable()]};

 const perComponent=[],modeFree=RIGID_BODY_MODES.map(()=>false);let totalFree=0;
 groups.forEach((group,index)=>{
  const center=[0,0,0];for(const node of group)for(let k=0;k<3;k++)center[k]+=mesh.nodes[node*3+k]/group.length;
  const scale=Math.max(...group.map(node=>Math.hypot(...center.map((c,k)=>mesh.nodes[node*3+k]-c))),1e-12),rows=[];let constrainedNodes=0;
  for(const node of group){const list=records.get(node);if(!list)continue;constrainedNodes++;const [x,y,z]=center.map((c,k)=>(mesh.nodes[node*3+k]-c)/scale);for(const [dx,dy,dz] of list)rows.push([dx,dy,dz,y*dz-z*dy,z*dx-x*dz,x*dy-y*dx]);}
  const {rank,nullSpace}=rigidConstraintRank(rows),freeModes=[];
  // Rotations: free when any free rigid motion has a rotation component about that axis (the axis may be offset).
  // Translations: free when that pure translation direction (no rotation) satisfies every constraint.
  const translationNull=rigidConstraintRank(rows.map(r=>[r[0],r[1],r[2],0,0,0])).nullSpace.filter(vec=>vec.slice(3).every(v=>Math.abs(v)<1e-9));
  RIGID_BODY_MODES.forEach((m,i)=>{const participation=(i<3?translationNull:nullSpace).reduce((s,vec)=>s+vec[i]*vec[i],0);if(participation>FREE_MODE_PARTICIPATION){modeFree[i]=true;freeModes.push(m.mode);}});
  totalFree+=6-rank;
  perComponent.push({index,nodeCount:group.length,constrainedNodeCount:constrainedNodes,constraintRowCount:rows.length,rank,freeRigidMotionCount:6-rank,freeModes});
 });
 const modes=RIGID_BODY_MODES.map((m,i)=>({...m,status:modeFree[i]?'free':'eliminated',description:modeFree[i]?describe(m):`${m.kind} ${m.kind==='translation'?'along':'about'} the ${m.axis} axis is constrained`}));
 const freeDescriptions=modes.filter(m=>m.status==='free').map(m=>m.description);
 const eliminated=totalFree===0;
 const result={status:'checked',rigidBodyModesEliminated:eliminated,freeRigidModeCount:totalFree,modes,components:perComponent.slice(0,50),componentsTruncated:perComponent.length>50,method:{rankTolerance:RANK_RELATIVE_TOLERANCE,rankToleranceKind:'relative to the largest singular value of the centroid-centred, radius-normalised constraint matrix',freeModeParticipationThreshold:FREE_MODE_PARTICIPATION,springSupports:'not modelled by boundary transfer; never counted as eliminating a mode'},diagnostics:[]};
 if(!eliminated)result.diagnostics.push({code:'ANALYSIS_RIGID_BODY_MODE_FREE',severity:'error',stage:'constraint-rank',target:'/conditions',message:`${totalFree} rigid-body motion${totalFree===1?'':'s'} remain${totalFree===1?'s':''} free: ${freeDescriptions.join('; ')}`,evidence:{freeRigidModeCount:totalFree,freeModes:modes.filter(m=>m.status==='free').map(m=>m.mode),components:perComponent.filter(c=>c.freeRigidMotionCount>0).map(c=>({index:c.index,rank:c.rank,requiredRank:6}))},suggestions:['Review the intended supports and coordinate directions; add the physical constraint that is genuinely missing rather than an artificial restraint'],requiresUserIntent:true});
 return result;
}
