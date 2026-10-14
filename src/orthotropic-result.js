import {orthotropicElasticity} from './orthotropic-material.js';
import {elementGeometry} from './fem-core.js';

export function validateOrthotropicResult(mesh,result,input,calculation){
 const data=input?.materialProperties?.orthotropic,record=result?.orthotropic;
 if(data===undefined&&record===undefined)return;
 const method=calculation?.options?.method;
 if(!data||!record||result?.kind!=='elastic'||input?.study?.kind!=='structural'||input.study.modalAnalysis||input.study.thermalStress||result.plasticity||result.hyperelastic||result.native||result.gpu||!['pcg','pcg-strict','wasm-pcg'].includes(method)||result.method!==method)throw Error('Invalid saved orthotropic analysis scope');
 const d=orthotropicElasticity(data);
 for(const key of Object.keys(data))if(JSON.stringify(record[key])!==JSON.stringify(data[key]))throw Error('Saved orthotropic material differs from its registered constants, axes or provenance');
 if(Object.keys(record).length!==Object.keys(data).length)throw Error('Invalid saved orthotropic material record');
 const finiteVector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
 if(!Array.isArray(mesh?.nodes)||!Array.isArray(mesh?.tetrahedra)||!finiteVector(result.displacement,mesh.nodes.length)||result.strains?.length!==mesh.tetrahedra.length||result.stresses?.length!==mesh.tetrahedra.length)throw Error('Invalid saved orthotropic fields');
 const near=(a,b,scale)=>Number.isFinite(a)&&Math.abs(a-b)<=1e-8*scale;
 for(let e=0;e<mesh.tetrahedra.length;e++){
  const t=mesh.tetrahedra[e];if(!Array.isArray(t)||t.length!==4||t.some(i=>!Number.isInteger(i)||i<0||i*3+2>=mesh.nodes.length))throw Error('Invalid saved orthotropic element');
  const {grad}=elementGeometry(mesh,t),g=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>t.reduce((s,node,a)=>s+result.displacement[node*3+i]*.001*grad[a][j],0))),strain=[g[0][0],g[1][1],g[2][2],g[0][1]+g[1][0],g[1][2]+g[2][1],g[2][0]+g[0][2]],stress=d.map(row=>row.reduce((s,v,i)=>s+v*strain[i],0));
  if(!finiteVector(result.strains[e],6)||!finiteVector(result.stresses[e],6)||result.strains[e].some((v,i)=>!near(v,strain[i],Math.max(1e-12,...strain.map(Math.abs))))||result.stresses[e].some((v,i)=>!near(v,stress[i],Math.max(1,...stress.map(Math.abs)))))throw Error('Saved orthotropic stress or strain does not match displacement and material axes');
 }
}
