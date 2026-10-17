import {tetraVolume,elementGeometry} from './tetra-geometry.js';
export const MAX_MESH_DIAGNOSTICS=20;
/** Pure retained Tet4 checks; no reordering, mesher, solver or invented quality cutoff. */
export function analyzeMeshValidity(mesh){
 const diagnostics=[];let diagnosticCount=0;
 const add=(code,target,message,evidence={})=>{diagnosticCount++;if(diagnostics.length<MAX_MESH_DIAGNOSTICS)diagnostics.push({code,severity:'error',stage:'mesh',target,message,evidence,suggestions:['Inspect the retained mesh and regenerate it from the intended geometry before solving'],requiresUserIntent:true});};
 const nodes=mesh?.nodes,tets=mesh?.tetrahedra;
 let volume=0,minVolume=Infinity,negativeOrientationCount=0,minQuality=null;const qualityHistogram=Array(5).fill(0);
 const report=()=>({status:'checked',nodeCount:Array.isArray(nodes)&&nodes.length%3===0?nodes.length/3:null,elementCount:Array.isArray(tets)?tets.length:null,volumeMm3:diagnosticCount?null:volume,minVolumeMm3:Number.isFinite(minVolume)?minVolume:null,negativeOrientationCount,minQuality,qualityHistogram,qualityAvailable:mesh?.qualities!=null,diagnosticCount,diagnosticsTruncated:diagnosticCount>MAX_MESH_DIAGNOSTICS});
 const done=()=>({allowed:diagnosticCount===0,report:report(),diagnostics});
 if(!Array.isArray(nodes)||nodes.length<12||nodes.length%3){add('ANALYSIS_MESH_NODES_INVALID','/job/mesh/nodes','Invalid volume mesh');return done();}
 let finiteNodes=true;for(let i=0;i<nodes.length;i++)if(!Object.hasOwn(nodes,i)||!Number.isFinite(nodes[i])){finiteNodes=false;add('ANALYSIS_MESH_NODE_NONFINITE','/job/mesh/nodes/'+i,'Nonfinite or missing mesh node coordinate',{nodeIndex:Math.floor(i/3),axis:i%3});}
 if(!Array.isArray(tets)||!tets.length){add('ANALYSIS_MESH_ELEMENTS_INVALID','/job/mesh/tetrahedra','Invalid volume mesh');return done();}
 for(let e=0;e<tets.length;e++){
  const t=tets[e],target='/job/mesh/tetrahedra/'+e;
  if(!Array.isArray(t)||t.length!==4||new Set(t).size!==4||!Array.from(t).every(i=>Number.isInteger(i)&&i>=0&&i<nodes.length/3)){add('ANALYSIS_MESH_ELEMENT_CONNECTIVITY_INVALID',target,'Invalid tetrahedron',{elementIndex:e});continue;}
  if(!finiteNodes)continue;
  const v=tetraVolume(nodes,t);
  if(!Number.isFinite(v)){add('ANALYSIS_MESH_ELEMENT_NONFINITE',target,'Nonfinite tetrahedron volume',{elementIndex:e});continue;}
  if(Math.abs(v)<1e-15){add('ANALYSIS_MESH_ELEMENT_DEGENERATE',target,'Degenerate tetrahedron',{elementIndex:e,absoluteVolumeMm3:Math.abs(v),minimumVolumeMm3:1e-15});continue;}
  if(v<0)negativeOrientationCount++;volume+=Math.abs(v);minVolume=Math.min(minVolume,Math.abs(v));
  try{const g=elementGeometry(mesh,t);if(!Number.isFinite(g.volume)||g.volume<=0||!g.grad.flat().every(Number.isFinite))add('ANALYSIS_MESH_ELEMENT_NONFINITE',target,'Nonfinite tetrahedron volume or gradient',{elementIndex:e});}
  catch{add('ANALYSIS_MESH_ELEMENT_SINGULAR',target,'Singular element',{elementIndex:e,pivotThreshold:1e-20});}
 }
 if(!Number.isFinite(volume))add('ANALYSIS_MESH_VOLUME_NONFINITE','/job/mesh/tetrahedra','Nonfinite accumulated mesh volume');
 if(mesh.qualities!=null){const q=mesh.qualities;
  if(!Array.isArray(q)||q.length!==tets.length)add('ANALYSIS_MESH_QUALITY_INVALID','/job/mesh/qualities','Invalid mesh quality data');
  else for(let e=0;e<q.length;e++){if(!Object.hasOwn(q,e)||!Number.isFinite(q[e]))add('ANALYSIS_MESH_QUALITY_INVALID','/job/mesh/qualities/'+e,'Invalid mesh quality data',{elementIndex:e});else{qualityHistogram[Math.max(0,Math.min(4,Math.floor(q[e]*5)))]++;minQuality=minQuality===null?q[e]:Math.min(minQuality,q[e]);}}
 }
 return done();
}
/** Only data descriptors are inspected when strict JSON serialization rejected the output. */
export function nonfiniteMeshCoordinateDiagnostic(output){
 const own=(object,key)=>{if(!object||typeof object!=='object')return undefined;const descriptor=Object.getOwnPropertyDescriptor(object,key);return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;};
 try{const mesh=own(output,'mesh'),nodes=own(mesh,'nodes');if(!Array.isArray(nodes))return null;for(let i=0;i<nodes.length;i++){const value=own(nodes,String(i));if(typeof value==='number'&&!Number.isFinite(value))return {code:'ANALYSIS_MESH_NODE_NONFINITE',target:'/job/mesh/nodes/'+i,evidence:{nodeIndex:Math.floor(i/3),axis:i%3}};}}catch{}return null;
}
