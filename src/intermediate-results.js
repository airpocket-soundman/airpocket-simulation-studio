import {sampleResult} from './probe.js';

function meshInfo(mesh){
 if(!mesh||!Array.isArray(mesh.nodes)||mesh.nodes.length<12||mesh.nodes.length%3||!mesh.nodes.every(Number.isFinite)||!Array.isArray(mesh.tetrahedra)||!mesh.tetrahedra.length||mesh.tetrahedra.some(t=>!Array.isArray(t)||t.length!==4||new Set(t).size!==4||t.some(i=>!Number.isInteger(i)||i<0||3*i>=mesh.nodes.length)))throw Error('Invalid intermediate mesh');
 const count=mesh.nodes.length/3,bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
 for(let i=0;i<count;i++)for(let k=0;k<3;k++){bounds[k]=Math.min(bounds[k],mesh.nodes[3*i+k]);bounds[k+3]=Math.max(bounds[k+3],mesh.nodes[3*i+k]);}
 return {nodeCount:count,elementCount:mesh.tetrahedra.length,boundsMm:bounds};
}
// Nodal scalar snapshots are provisional and need not contain final fluxes or convergence.
export function inspectIntermediate(snapshot,mesh,{point,offset=0,limit=0}={}){
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<0||limit>200)throw Error('Invalid intermediate page');
 const info=meshInfo(mesh);if(offset>info.nodeCount)throw Error('Intermediate offset exceeds node count');
 const out={mesh:info,provisional:true};
 const field=snapshot.field;
 let values,name,unit;
 if(field){
  if(!['thermal','acousticTransient'].includes(field.kind)||!Number.isFinite(field.time)||field.time<0)throw Error('Unsupported intermediate field');
  name=field.kind==='thermal'?'temperature':'pressure';unit=field.kind==='thermal'?'degC':'Pa';values=field[name];
  if(!Array.isArray(values)||values.length!==info.nodeCount||!values.every(Number.isFinite)||field.units?.[name]!==unit)throw Error('Invalid intermediate scalar values or units');
  let minimum=Infinity,maximum=-Infinity;for(const value of values){minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);}
  out.field={kind:field.kind,name,unit,time:field.time,timeUnit:'s',minimum,maximum};
 }
 if(point!==undefined){
  if(!values)throw Error('A scalar field is required for intermediate measurement');
  const {pressurePa,...sample}=sampleResult(mesh,{kind:'acousticTransient',pressure:values,time:field.time},point);
  out.measurement={...sample,value:pressurePa,field:name,unit,timeUnit:'s'};
 }
 if(limit){
  const end=Math.min(offset+limit,info.nodeCount);
  out.page={offset,count:end-offset,total:info.nodeCount,nextOffset:end,hasMore:end<info.nodeCount,nodesMm:Array.from({length:end-offset},(_,i)=>mesh.nodes.slice(3*(offset+i),3*(offset+i)+3)),...(values?{values:values.slice(offset,end)}:{})};
 }
 return out;
}
