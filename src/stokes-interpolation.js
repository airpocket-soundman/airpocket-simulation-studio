export const tet10Edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
export function stokesVelocityAt(result,element,weights){
 if(result.stokes?.velocityElement!=='P2')throw Error('Quadratic velocity requires a Taylor-Hood result');
 const ids=result.cellVelocityNodeIds?.[element],n=result.velocity.length/3;
 if(!ids||ids.length!==10||!Array.isArray(weights)||weights.length!==4||!weights.every(Number.isFinite))throw Error('Invalid quadratic velocity sample');
 const shape=[...weights.map(v=>v*(2*v-1)),...tet10Edges.map(([a,b])=>4*weights[a]*weights[b])];
 return [0,1,2].map(k=>ids.reduce((sum,node,i)=>sum+shape[i]*(node<n?result.velocity[3*node+k]:result.edgeVelocity[3*(node-n)+k]),0));
}
// Four render triangles preserve the actual midpoint field on each flat face.
// Geometry stays the existing faceted CAD boundary; this is not curved Tet10 geometry.
export function refineResultTriangles(section){
 const out={positions:[],physicalPositions:[],samples:[],elementIndices:[],bodyIndices:[]};
 for(let face=0;face<section.elementIndices.length;face++){
  const samples=section.samples.slice(3*face,3*face+3),points=section.positions.slice(9*face,9*face+9),physical=section.physicalPositions.slice(9*face,9*face+9),mix=(a,b,key)=>[0,1,2].map(k=>(key[3*a+k]+key[3*b+k])/2),extended=[...samples,...[[0,1],[0,2],[1,2]].map(([a,b])=>({...samples[a],weights:samples[a].weights.map((v,k)=>(v+samples[b].weights[k])/2)}))],render=[...points,...[[0,1],[0,2],[1,2]].flatMap(([a,b])=>mix(a,b,points))],real=[...physical,...[[0,1],[0,2],[1,2]].flatMap(([a,b])=>mix(a,b,physical))];
  for(const triangle of [[0,3,4],[3,1,5],[4,5,2],[3,5,4]]){for(const i of triangle){out.positions.push(...render.slice(3*i,3*i+3));out.physicalPositions.push(...real.slice(3*i,3*i+3));out.samples.push(extended[i]);}out.elementIndices.push(section.elementIndices[face]);out.bodyIndices.push(section.bodyIndices?.[face]);}
 }return out;
}
