import {invert} from './fem-core.js';
export function validateTemperatureSource(source){
 const m=source?.mesh;
 if(!m||!Array.isArray(m.nodes)||m.nodes.length%3||!m.nodes.length||m.nodes.length>360000||!m.nodes.every(Number.isFinite)||!Array.isArray(m.tetrahedra)||!m.tetrahedra.length||m.tetrahedra.length>30000||!Array.isArray(source.temperature)||source.temperature.length!==m.nodes.length/3||!source.temperature.every(v=>Number.isFinite(v)&&v>=-273.15))throw Error('Invalid transferred temperature field');
 for(const t of m.tetrahedra)if(!Array.isArray(t)||t.length!==4||new Set(t).size!==4||!t.every(i=>Number.isInteger(i)&&i>=0&&i<m.nodes.length/3))throw Error('Invalid transferred temperature elements');
 if(m.nodeBodies!==undefined&&(!Array.isArray(m.nodeBodies)||m.nodeBodies.length!==m.nodes.length/3||!m.nodeBodies.every(v=>Number.isInteger(v)&&v>=0)||m.tetrahedra.some(t=>t.some(i=>m.nodeBodies[i]!==m.nodeBodies[t[0]]))))throw Error('Invalid thermal body identifiers');
 return source;
}
export function transferTemperature(source,target){
 validateTemperatureSource(source);
 if(!Array.isArray(target.nodes)||target.nodes.length%3||!target.nodes.every(Number.isFinite))throw Error('Invalid temperature transfer target');
 if(source.mesh.nodeBodies&&(!Array.isArray(target.nodeBodies)||target.nodeBodies.length!==target.nodes.length/3||!target.nodeBodies.every(v=>Number.isInteger(v)&&v>=0)))throw Error('Matching target body identifiers required');
 const items=source.mesh.tetrahedra.map(t=>{const p=t.map(i=>source.mesh.nodes.slice(i*3,i*3+3)),lo=[0,1,2].map(k=>Math.min(...p.map(v=>v[k]))),hi=[0,1,2].map(k=>Math.max(...p.map(v=>v[k])));return {t,lo,hi,body:source.mesh.nodeBodies?.[t[0]],inv:invert(p.map(v=>[1,...v]))};});
 function build(list){const lo=[0,1,2].map(k=>Math.min(...list.map(v=>v.lo[k]))),hi=[0,1,2].map(k=>Math.max(...list.map(v=>v.hi[k])));if(list.length<=12)return {lo,hi,list};const axis=[0,1,2].sort((a,b)=>(hi[b]-lo[b])-(hi[a]-lo[a]))[0];list.sort((a,b)=>(a.lo[axis]+a.hi[axis])-(b.lo[axis]+b.hi[axis]));const mid=Math.floor(list.length/2);return {lo,hi,left:build(list.slice(0,mid)),right:build(list.slice(mid))};}
 const tree=build(items),inside=(p,b)=>p.every((v,k)=>v>=b.lo[k]-1e-7&&v<=b.hi[k]+1e-7);
 function find(branch,p,body){if(!inside(p,branch))return null;if(!branch.list)return find(branch.left,p,body)??find(branch.right,p,body);for(const item of branch.list){if((source.mesh.nodeBodies&&item.body!==body)||!inside(p,item))continue;const w=item.t.map((_,i)=>item.inv[0][i]+p.reduce((s,v,k)=>s+item.inv[k+1][i]*v,0));if(w.every(v=>v>=-1e-7&&v<=1+1e-7))return item.t.reduce((s,node,k)=>s+w[k]*source.temperature[node],0);}return null;}
 return Array.from({length:target.nodes.length/3},(_,i)=>{const value=find(tree,target.nodes.slice(i*3,i*3+3),target.nodeBodies?.[i]);if(value===null)throw Error('Structural node outside saved thermal mesh; use the same solid geometry');return value;});
}
