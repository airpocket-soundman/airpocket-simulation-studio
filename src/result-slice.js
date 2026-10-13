const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
export function tetrahedronSection(mesh,{axis,position,flip=false,displayNodes=mesh.nodes}={}){
 if(!Number.isInteger(axis)||axis<0||axis>2||!Number.isFinite(position)||typeof flip!=='boolean'||displayNodes.length!==mesh.nodes.length||!Array.from(displayNodes).every(Number.isFinite))throw Error('Invalid result section');
 const across=[0,1,2].filter(k=>k!==axis),sign=flip?-1:1,positions=[],physicalPositions=[],samples=[],elementIndices=[],bodyIndices=[],skin=new Set((mesh.surface||[]).map(f=>[...f.nodes].sort((a,b)=>a-b).join(',')));
 let extent=0;for(let k=0;k<3;k++){let lo=Infinity,hi=-Infinity;for(let i=k;i<displayNodes.length;i+=3){lo=Math.min(lo,displayNodes[i]);hi=Math.max(hi,displayNodes[i]);}extent=Math.max(extent,hi-lo);}const eps=Math.max(1e-8,extent*1e-10);
 for(const [element,t]of mesh.tetrahedra.entries()){
  const p=t.map(i=>Array.from(displayNodes.slice(3*i,3*i+3))),d=p.map(v=>v[axis]-position);if(!d.some(v=>sign*v>eps)||d.every(v=>v>eps)||d.every(v=>v< -eps))continue;
  const points=[];
  function add(weights){const point=[0,1,2].map(k=>p.reduce((s,v,i)=>s+weights[i]*v[k],0));point[axis]=position;if(points.some(v=>Math.hypot(...point.map((x,k)=>x-v.point[k]))<=eps))return;points.push({point,weights});}
  for(let i=0;i<4;i++)if(Math.abs(d[i])<=eps)add(Array.from({length:4},(_,j)=>i===j?1:0));
  for(const [a,b]of edges)if(d[a]*d[b]<0&&Math.abs(d[a])>eps&&Math.abs(d[b])>eps){const fraction=d[a]/(d[a]-d[b]),w=[0,0,0,0];w[a]=1-fraction;w[b]=fraction;add(w);}
  if(points.length<3)continue;
  const originalFace=points.length===3&&points.every(v=>v.weights.some(w=>w===1))?points.map(v=>t[v.weights.indexOf(1)]).sort((a,b)=>a-b).join(','):null;if(originalFace&&skin.has(originalFace))continue;
  const center=across.map(k=>points.reduce((s,v)=>s+v.point[k]/points.length,0));points.sort((a,b)=>Math.atan2(a.point[across[1]]-center[1],a.point[across[0]]-center[0])-Math.atan2(b.point[across[1]]-center[1],b.point[across[0]]-center[0]));
  for(let i=1;i<points.length-1;i++){const triangle=[points[0],points[i],points[i+1]];for(const v of triangle){positions.push(...v.point);physicalPositions.push(...[0,1,2].map(k=>t.reduce((s,node,j)=>s+v.weights[j]*mesh.nodes[3*node+k],0)));samples.push({nodes:t,weights:v.weights,element});}elementIndices.push(element);bodyIndices.push(mesh.nodeBodies?.[t[0]]);}
 }
 return {positions,physicalPositions,samples,elementIndices,bodyIndices};
}

export function mapResultProbe(physicalPositions,faceIndex,weights){
 if(!Number.isInteger(faceIndex)||faceIndex<0||faceIndex*9+8>=physicalPositions.length||!Array.isArray(weights)||weights.length!==3||!weights.every(v=>Number.isFinite(v)&&v>=-1e-7&&v<=1+1e-7)||Math.abs(weights.reduce((s,v)=>s+v,0)-1)>1e-7)throw Error('Invalid result probe mapping');
 return [0,1,2].map(k=>weights.reduce((sum,w,i)=>sum+w*physicalPositions[faceIndex*9+i*3+k],0));
}
