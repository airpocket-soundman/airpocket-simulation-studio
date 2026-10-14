import {sampleResult} from './probe.js';

function meshInfo(mesh){
 if(!mesh||!Array.isArray(mesh.nodes)||mesh.nodes.length<12||mesh.nodes.length%3||!mesh.nodes.every(Number.isFinite)||!Array.isArray(mesh.tetrahedra)||!mesh.tetrahedra.length||mesh.tetrahedra.some(t=>!Array.isArray(t)||t.length!==4||new Set(t).size!==4||t.some(i=>!Number.isInteger(i)||i<0||3*i>=mesh.nodes.length)))throw Error('Invalid intermediate mesh');
 const count=mesh.nodes.length/3,hasBodies=mesh.nodeBodies!==undefined;if(hasBodies&&(!Array.isArray(mesh.nodeBodies)||mesh.nodeBodies.length!==count||!Array.from(mesh.nodeBodies).every(value=>Number.isSafeInteger(value)&&value>=0)||mesh.tetrahedra.some(t=>t.some(index=>mesh.nodeBodies[index]!==mesh.nodeBodies[t[0]]))))throw Error('Invalid intermediate body identifiers or mixed-body tetrahedron');
 const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
 for(let i=0;i<count;i++)for(let k=0;k<3;k++){bounds[k]=Math.min(bounds[k],mesh.nodes[3*i+k]);bounds[k+3]=Math.max(bounds[k+3],mesh.nodes[3*i+k]);}
 return {nodeCount:count,elementCount:mesh.tetrahedra.length,boundsMm:bounds,bodyIdentifiersAvailable:hasBodies,bodyCount:hasBodies?new Set(mesh.nodeBodies).size:null};
}
// Retained nodal snapshots remain provisional, including converged load steps.
export function inspectIntermediate(snapshot,mesh,{point,offset=0,limit=0,bodyIndex,elementIndex}={}){
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<0||limit>200)throw Error('Invalid intermediate page');
 for(const selector of [bodyIndex,elementIndex])if(selector!==undefined&&(!Number.isSafeInteger(selector)||selector<0))throw Error('Invalid intermediate measurement selector');if((bodyIndex!==undefined||elementIndex!==undefined)&&point===undefined)throw Error('Intermediate selectors require a measurement point');
 const info=meshInfo(mesh);if(bodyIndex!==undefined&&!info.bodyIdentifiersAvailable)throw Error('Intermediate body selection requires body identifiers');if(bodyIndex!==undefined&&!mesh.nodeBodies.includes(bodyIndex))throw Error('Unknown intermediate body identifier');if(elementIndex!==undefined&&elementIndex>=mesh.tetrahedra.length)throw Error('Invalid intermediate element index');if(offset>info.nodeCount)throw Error('Intermediate offset exceeds node count');
 const out={mesh:info,provisional:true};
 const field=snapshot.field;
 let values,vectors,name,unit;
 if(field?.kind==='structuralDisplacement'){
  const allowed=['kind','solver','step','steps','loadFactor','displacement','units'];
  if(Reflect.ownKeys(field).some(key=>typeof key!=='string'||!allowed.includes(key))||!['plasticity','hyperelastic'].includes(field.solver)||!Number.isInteger(field.steps)||field.steps<1||field.steps>30||!Number.isInteger(field.step)||field.step<1||field.step>field.steps||!Number.isFinite(field.loadFactor)||field.loadFactor<0||field.loadFactor>1||!field.units||Reflect.ownKeys(field.units).length!==1||field.units.displacement!=='mm')throw Error('Invalid intermediate structural field metadata');
  vectors=field.displacement;if(!Array.isArray(vectors)||vectors.length!==3*info.nodeCount||!vectors.every(Number.isFinite))throw Error('Invalid intermediate displacement vector');
  let minimumMagnitudeMm=Infinity,maximumMagnitudeMm=0;for(let i=0;i<info.nodeCount;i++){const magnitude=Math.hypot(...vectors.slice(3*i,3*i+3));if(!Number.isFinite(magnitude))throw Error('Intermediate displacement magnitude exceeds numerical range');minimumMagnitudeMm=Math.min(minimumMagnitudeMm,magnitude);maximumMagnitudeMm=Math.max(maximumMagnitudeMm,magnitude);}
  name='displacement';unit='mm';out.field={kind:field.kind,name,unit,solver:field.solver,step:field.step,steps:field.steps,loadFactor:field.loadFactor,minimumMagnitudeMm,maximumMagnitudeMm};
 }else if(field){
  if(!['thermal','acousticTransient'].includes(field.kind)||!Number.isFinite(field.time)||field.time<0)throw Error('Unsupported intermediate field');
  name=field.kind==='thermal'?'temperature':'pressure';unit=field.kind==='thermal'?'degC':'Pa';values=field[name];
  if(!Array.isArray(values)||values.length!==info.nodeCount||!values.every(Number.isFinite)||field.units?.[name]!==unit)throw Error('Invalid intermediate scalar values or units');
  let minimum=Infinity,maximum=-Infinity;for(const value of values){minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);}
  out.field={kind:field.kind,name,unit,time:field.time,timeUnit:'s',minimum,maximum};
 }
 if(point!==undefined){
  if(vectors){
   const {element,weights,bodyIndex:sampleBody}=sampleResult(mesh,{kind:'acousticTransient',pressure:Array(info.nodeCount).fill(0)},point,{bodyIndex,elementIndex});
   const displacementMm=[0,1,2].map(k=>mesh.tetrahedra[element].reduce((sum,node,i)=>sum+weights[i]*vectors[3*node+k],0)),magnitudeMm=Math.hypot(...displacementMm);if(!displacementMm.every(Number.isFinite)||!Number.isFinite(magnitudeMm))throw Error('Intermediate displacement measurement exceeds numerical range');
   out.measurement={point:[...point],element,weights,...(sampleBody!==undefined?{bodyIndex:sampleBody}:{}),displacementMm,magnitudeMm,step:field.step,steps:field.steps,loadFactor:field.loadFactor,unit,field:name};
  }else{
  if(!values)throw Error('A scalar field is required for intermediate measurement');
  const {pressurePa,...sample}=sampleResult(mesh,{kind:'acousticTransient',pressure:values,time:field.time},point,{bodyIndex,elementIndex});
  out.measurement={...sample,value:pressurePa,field:name,unit,timeUnit:'s'};
  }
 }
 if(limit){
  const end=Math.min(offset+limit,info.nodeCount);
  out.page={offset,count:end-offset,total:info.nodeCount,nextOffset:end,hasMore:end<info.nodeCount,nodesMm:Array.from({length:end-offset},(_,i)=>mesh.nodes.slice(3*(offset+i),3*(offset+i)+3)),...(values?{values:values.slice(offset,end)}:{}),...(vectors?{displacementMm:Array.from({length:end-offset},(_,i)=>vectors.slice(3*(offset+i),3*(offset+i)+3))}:{}),...(mesh.nodeBodies!==undefined?{nodeBodies:mesh.nodeBodies.slice(offset,end)}:{})};
 }
 return out;
}
