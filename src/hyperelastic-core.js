import {elementGeometry,pcg,invert,principalStresses} from './fem-core.js';
import {prepareConstraints,transformStiffness,toGlobal,toLocal} from './constraints.js';
import {meshComponents} from './components.js';

import {validateHyperelastic} from './hyperelastic-material.js';
export {validateHyperelastic} from './hyperelastic-material.js';

// W = mu/2 (tr(F^T F)-3) - mu ln J + lambda/2 (ln J)^2.
// Tangent indices follow A[i,J,k,L] = dP[i,J]/dF[k,L].
export function neoHookean(F,h,{tangent=true}={}){
 validateHyperelastic(h);
 if(!Array.isArray(F)||F.length!==3||F.some(r=>!Array.isArray(r)||r.length!==3||!r.every(Number.isFinite)))throw Error('Invalid deformation gradient');
 const J=F[0][0]*(F[1][1]*F[2][2]-F[1][2]*F[2][1])-F[0][1]*(F[1][0]*F[2][2]-F[1][2]*F[2][0])+F[0][2]*(F[1][0]*F[2][1]-F[1][1]*F[2][0]);
 if(!(J>1e-8)||!Number.isFinite(J))throw Error('Inverted or collapsed hyperelastic element');
 const mu=h.shearModulus,lambda=h.bulkModulus-2*mu/3,log=Math.log(J),q=lambda*log-mu,inv=invert(F),P=F.map((r,i)=>r.map((v,j)=>mu*v+q*inv[j][i]));
 const sigma=F.map((r,i)=>F.map((s,k)=>(mu*r.reduce((sum,v,j)=>sum+v*s[j],0)+(i===k?q:0))/J));
 const A=tangent?new Float64Array(81):null;
 if(A)for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)for(let l=0;l<3;l++)A[((i*3+j)*3+k)*3+l]=mu*(i===k&&j===l?1:0)+lambda*inv[j][i]*inv[l][k]-q*inv[j][k]*inv[l][i];
 return {J,energy:mu/2*(F.flat().reduce((s,v)=>s+v*v,0)-3)-mu*log+lambda/2*log*log,P,sigma,A};
}

export function solveHyperelastic(mesh,properties,boundary,{method='wasm-pcg',matvecFactory,gravity=[0,0,0],loadSteps=10,maxNewtonIterations=30,onProgress=()=>{},onObserve,observeFields=false}={}){
 if(typeof observeFields!=='boolean')throw Error('observeFields must be a boolean');
 const h=properties.hyperelastic;validateHyperelastic(h);if(!h)throw Error('Hyperelastic parameters required');
 if(!['pcg','pcg-strict','wasm-pcg'].includes(method))throw Error('Hyperelastic analysis currently supports Airpocket CPU solvers only');
 if(!Number.isInteger(loadSteps)||loadSteps<1||loadSteps>30||!Number.isInteger(maxNewtonIterations)||maxNewtonIterations<1||maxNewtonIterations>50)throw Error('Invalid nonlinear iteration settings');
 if(!Array.isArray(gravity)||gravity.length!==3||!gravity.every(Number.isFinite)||gravity.some(v=>v!==0)&&(!(properties.density>0)||!Number.isFinite(properties.density)))throw Error('Valid density and acceleration required for hyperelastic gravity');
 if(mesh.tetrahedra.length>2000||mesh.nodes.length/3>2000)throw Error('Hyperelastic prototype limit is 2000 tetrahedra and 2000 nodes');
 const n=mesh.nodes.length,{bases,dirichlet}=prepareConstraints(mesh,boundary,meshComponents(mesh)),fixed=new Set(dirichlet.keys()),zero=new Map([...dirichlet].map(([i])=>[i,0])),external=new Float64Array(n),bodyLoadN=[0,0,0];
 for(const {node,value}of boundary.forces||[])for(let k=0;k<3;k++)external[node*3+k]+=value[k];
 const elements=mesh.tetrahedra.map(t=>({nodes:t,ids:t.flatMap(i=>[i*3,i*3+1,i*3+2]),...elementGeometry(mesh,t)}));
 for(const e of elements)for(let k=0;k<3;k++){const f=(properties.density??0)*e.volume*gravity[k];bodyLoadN[k]+=f;for(const node of e.nodes)external[node*3+k]+=f/4;}
 const force=toLocal(external,bases),u=new Float64Array(n),history=[];
 function assemble(local,scale,tangent){const global=toGlobal(local,bases),internal=new Float64Array(n),entries=[],states=[];let energy=0;
  for(const e of elements){const F=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>(i===j?1:0)+e.nodes.reduce((s,node,a)=>s+global[node*3+i]*e.grad[a][j],0))),state=neoHookean(F,h,{tangent});states.push({...state,F});energy+=state.energy*e.volume;
   for(let a=0;a<4;a++)for(let i=0;i<3;i++)for(let j=0;j<3;j++)internal[e.nodes[a]*3+i]+=e.volume*state.P[i][j]*e.grad[a][j];
   if(tangent){const k=new Float64Array(144);for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(let i=0;i<3;i++)for(let l=0;l<3;l++)for(let j=0;j<3;j++)for(let m=0;m<3;m++)k[(a*3+i)*12+b*3+l]+=e.volume*e.grad[a][j]*state.A[((i*3+j)*3+l)*3+m]*e.grad[b][m];entries.push({ids:e.ids,k:transformStiffness(e.nodes,k,bases)});}
  }
  const localInternal=toLocal(internal,bases),residual=Float64Array.from(localInternal,(v,i)=>v-scale*force[i]);let norm2=0,reference2=0;for(let i=0;i<n;i++){energy-=scale*force[i]*local[i];if(!fixed.has(i)){norm2+=residual[i]**2;reference2+=(scale*force[i])**2;}}
  // Reactions provide a scale for displacement-driven problems with zero free load.
  const reactionScale=Math.sqrt(localInternal.reduce((s,v,i)=>s+(fixed.has(i)?v*v:0),0));
  return {entries,states,internal,localInternal,residual,energy,norm:Math.sqrt(norm2),reference:Math.max(Math.sqrt(reference2),reactionScale,1e-9)};
 }
 let state,totalNewton=0,totalCG=0;
 for(let step=1;step<=loadSteps;step++){const scale=step/loadSteps;for(const [i,v]of dirichlet)u[i]=scale*v;let converged=false;
  for(let iteration=0;iteration<maxNewtonIterations;iteration++){state=assemble(u,scale,true);const relative=state.norm/state.reference;if(relative<1e-8){history.push({step,loadFraction:scale,newtonIterations:iteration,residual:relative,minJ:Math.min(...state.states.map(s=>s.J)),energyJ:state.energy});converged=true;break;}
   const rhs=Float64Array.from(state.residual,(v,i)=>fixed.has(i)?0:-v),correction=pcg(n,state.entries,rhs,zero,{tolerance:1e-10,maxIterations:2500,matvecFactory});totalCG+=correction.iterations;
   let accepted=false;for(let attempt=0;attempt<20;attempt++){const alpha=2**(-attempt),trial=Float64Array.from(u,(v,i)=>v+alpha*correction.solution[i]);try{const candidate=assemble(trial,scale,false);if(candidate.norm<state.norm*(1-1e-4*alpha)){u.set(trial);accepted=true;break;}}catch(e){if(!e.message.includes('Inverted or collapsed'))throw e;}}
   if(!accepted)throw Error('Hyperelastic Newton line search failed; reduce the load or increase load steps');totalNewton++;
  }
  if(!converged)throw Error('Hyperelastic Newton iteration limit reached; no converged result returned');onObserve?.({stage:'load-step',kind:'hyperelastic',step,steps:loadSteps,converged:true,metrics:history.at(-1),...(observeFields?{field:{kind:'structuralDisplacement',solver:'hyperelastic',step,steps:loadSteps,loadFactor:scale,displacement:Array.from(toGlobal(u,bases),v=>v*1000),units:{displacement:'mm'}}}:{})});onProgress('Hyperelastic load step '+step+'/'+loadSteps+' converged');
 }
 state=assemble(u,1,false);const global=toGlobal(u,bases),stresses=state.states.map(s=>[s.sigma[0][0],s.sigma[1][1],s.sigma[2][2],s.sigma[0][1],s.sigma[1][2],s.sigma[0][2]]),strains=state.states.map(s=>{const C=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>s.F.reduce((sum,r)=>sum+r[i]*r[j],0)));return [(C[0][0]-1)/2,(C[1][1]-1)/2,(C[2][2]-1)/2,C[0][1],C[1][2],C[0][2]];}),vonMises=stresses.map(s=>Math.sqrt(.5*((s[0]-s[1])**2+(s[1]-s[2])**2+(s[2]-s[0])**2)+3*(s[3]**2+s[4]**2+s[5]**2))),localReaction=Float64Array.from(state.residual,(v,i)=>fixed.has(i)?v:0),globalReaction=toGlobal(localReaction,bases),reaction=[0,0,0],applied=[0,0,0],constraintReactions=[];
 for(let node=0;node<n/3;node++){for(let k=0;k<3;k++){reaction[k]+=globalReaction[node*3+k];applied[k]+=external[node*3+k];}if([0,1,2].some(k=>fixed.has(node*3+k)))constraintReactions.push({node,force:Array.from(globalReaction.slice(node*3,node*3+3))});}
 const constraintRegionReactions=(boundary.reports||[]).filter(r=>r.nodes).map(r=>{const force=r.nodes.reduce((sum,node)=>sum.map((v,k)=>v+globalReaction[node*3+k]),[0,0,0]),direction=r.direction?.map(v=>v/Math.hypot(...r.direction));return {conditionIndex:r.conditionIndex,type:r.type,valueMm:r.valueMm,force,directionalReactionN:direction?force.reduce((sum,v,k)=>sum+v*direction[k],0):null,includesSharedNodes:true};}),displacement=Array.from(global,v=>v*1000),magnitudes=Array.from({length:n/3},(_,i)=>Math.hypot(...displacement.slice(i*3,i*3+3)));
 return {kind:'elastic',engine:'Airpocket finite-strain Tet4 / '+(matvecFactory?'WASM CPU':'JavaScript CPU'),method,displacement,magnitudes,stresses,strains,vonMises,principal:stresses.map(principalStresses),reaction,applied,bodyLoadN,forceBalanceErrorN:reaction.map((v,k)=>v+applied[k]),constraintReactions,constraintRegionReactions,iterations:totalCG,residual:state.norm/state.reference,maxDisplacementMm:Math.max(...magnitudes),maxVonMisesPa:Math.max(...vonMises),hyperelastic:{model:h.model,loadSteps,history,newtonIterations:totalNewton,minJ:Math.min(...state.states.map(s=>s.J)),strainMeasure:'Green-Lagrange',stressMeasure:'Cauchy'}};
}
