import {elementGeometry,pcg,principalStresses} from './fem-core.js';
import {prepareConstraints,transformStiffness,toGlobal,toLocal} from './constraints.js';
import {meshComponents} from './components.js';
import {validatePlasticity} from './plasticity-material.js';
export {validatePlasticity} from './plasticity-material.js';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const equivalent=s=>Math.sqrt(.5*((s[0]-s[1])**2+(s[1]-s[2])**2+(s[2]-s[0])**2)+3*(s[3]**2+s[4]**2+s[5]**2));
function constants(p){const E=p.youngModulus,nu=p.poissonRatio;if(!(E>0)||!Number.isFinite(E)||!Number.isFinite(nu)||nu<=-1||nu>=.49)throw Error('Valid elastic constants required for plasticity');validatePlasticity(p.plasticity);if(!p.plasticity)throw Error('Plasticity parameters required');return {mu:E/(2*(1+nu)),K:E/(3*(1-2*nu)),H:p.plasticity.hardeningModulus,sy:p.plasticity.yieldStress};}
// Backward Euler associative J2 radial return. Strains use engineering shear;
// the tangent is d(stress vector)/d(engineering strain vector).
export function j2Return(strain6,properties,previousState={}, {tangent=true}={}){
 const {mu,K,H,sy}=constants(properties),ep=previousState.plasticStrain??Array(6).fill(0),old=previousState.equivalentPlasticStrain??0;
 if(!Array.isArray(strain6)||strain6.length!==6||!strain6.every(Number.isFinite)||!Array.isArray(ep)||ep.length!==6||!ep.every(Number.isFinite)||!Number.isFinite(old)||old<0)throw Error('Invalid plasticity strain or committed state');
 // Accumulated equivalent strain bounds the norm of the plastic strain even
 // after nonproportional loading; associative J2 flow preserves zero trace.
 const epNorm=Math.sqrt(ep.reduce((sum,v,i)=>sum+(i<3?2/3:1/3)*v*v,0)),stateTolerance=1e-12+1e-8*Math.max(epNorm,old);
 if(Math.abs(ep[0]+ep[1]+ep[2])>stateTolerance||old+stateTolerance<epNorm)throw Error('Invalid plasticity committed state: plastic strain must be trace-free and bounded by accumulated equivalent strain');
 const elastic=strain6.map((v,i)=>v-ep[i]),tr=elastic[0]+elastic[1]+elastic[2],s=elastic.map((v,i)=>i<3?2*mu*(v-tr/3):mu*v),q=equivalent(s),yieldStress=sy+H*old,dk=Math.max(0,(q-yieldStress)/(3*mu+H)),a=dk?1-3*mu*dk/q:1;
 const stress=s.map((v,i)=>a*v+(i<3?K*tr:0)),plasticStrain=ep.map((v,i)=>v+(dk?(i<3?1.5:3)*dk*s[i]/q:0)),kappa=old+dk;
 const D=tangent?Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>{
 const dev=i<3&&j<3?2*mu*((i===j?1:0)-1/3):(i===j?mu:0);
 return (i<3&&j<3?K:0)+a*dev-(dk?9*mu*mu*yieldStress/((3*mu+H)*q*q*q)*s[i]*s[j]:0);
 })):null;
 const ee=strain6.map((v,i)=>v-plasticStrain[i]);
 return {stress,stress6:stress,plasticStrain,equivalentPlasticStrain:kappa,tangent:D,tangent6x6:D,plasticIncrement:dk,elasticEnergy:.5*dot(stress,ee),hardeningEnergy:.5*H*kappa*kappa,plasticDissipation:sy*kappa};
}
function strainMatrix(grad){const B=Array.from({length:6},()=>Array(12).fill(0));grad.forEach(([x,y,z],a)=>{const i=3*a;B[0][i]=x;B[1][i+1]=y;B[2][i+2]=z;B[3][i]=y;B[3][i+1]=x;B[4][i+1]=z;B[4][i+2]=y;B[5][i]=z;B[5][i+2]=x;});return B;}
export function solvePlasticity(mesh,properties,boundary,options={}){
 const {method='wasm-pcg',matvecFactory,gravity=[0,0,0],loadSteps:requestedSteps=10,maxNewtonIterations=30,onProgress=()=>{},onObserve,observeFields=false}=options;if(typeof observeFields!=='boolean')throw Error('Invalid plasticity observeFields setting');constants(properties);
 const requestedFractions=options.loadFractions;
 if(requestedFractions!==undefined&&(!Array.isArray(requestedFractions)||requestedFractions.length<1||requestedFractions.length>30||!requestedFractions.every(v=>Number.isFinite(v)&&v>=0&&v<=1)||!(requestedFractions[0]>0)||!(requestedFractions.at(-1)>0)||!requestedFractions.includes(1)))throw Error('Invalid plasticity load fractions: require 1–30 values in [0,1], positive first and last values, and a peak of 1');
 if(requestedFractions!==undefined&&options.loadSteps!==undefined&&options.loadSteps!==requestedFractions.length)throw Error('Plasticity load steps must match the load fractions length');
 const loadSteps=requestedFractions===undefined?requestedSteps:requestedFractions.length;
 if(!['pcg','pcg-strict','wasm-pcg'].includes(method))throw Error('Plasticity supports Airpocket CPU solvers only');
 if(options.adaptive)throw Error('Plasticity does not support adaptive refinement');
 const dependence=properties.dependence;
 if(dependence?.elasticTemperatureTable!==undefined||properties.elasticTemperatureTable!==undefined)throw Error('Plasticity does not support elastic temperature tables');
 if(dependence?.rateDependent||properties.rateDependent)throw Error('Plasticity does not support rate-dependent materials');
 if(dependence?.directionality==='orthotropic'||properties.directionality==='orthotropic'||properties.orthotropic!==undefined)throw Error('Plasticity does not support orthotropic materials');
 if(options.temperature!==undefined||properties.hyperelastic)throw Error('Plasticity does not support thermal stress or hyperelasticity');
 if(!Number.isInteger(loadSteps)||loadSteps<1||loadSteps>30||!Number.isInteger(maxNewtonIterations)||maxNewtonIterations<1||maxNewtonIterations>50)throw Error('Invalid nonlinear iteration settings');
 const loadFractions=requestedFractions===undefined?Array.from({length:loadSteps},(_,i)=>(i+1)/loadSteps):requestedFractions.slice(),finalFraction=loadFractions.at(-1);
 if(!Array.isArray(gravity)||gravity.length!==3||!gravity.every(Number.isFinite)||gravity.some(v=>v!==0)&&(!(properties.density>0)||!Number.isFinite(properties.density)))throw Error('Valid density and acceleration required for plasticity gravity');
 if(!mesh.tetrahedra.length||mesh.tetrahedra.length>2000||mesh.nodes.length/3>2000)throw Error('Plasticity prototype limit is 2000 tetrahedra and 2000 nodes');
 const n=mesh.nodes.length,{bases,dirichlet}=prepareConstraints(mesh,boundary,meshComponents(mesh)),fixed=new Set(dirichlet.keys()),zero=new Map([...dirichlet].map(([i])=>[i,0])),external=new Float64Array(n),bodyLoadN=[0,0,0];
 for(const {node,value} of boundary.forces||[])for(let k=0;k<3;k++)external[node*3+k]+=value[k];
 const elements=mesh.tetrahedra.map(nodes=>{const geo=elementGeometry(mesh,nodes);return {nodes,ids:nodes.flatMap(i=>[3*i,3*i+1,3*i+2]),...geo,B:strainMatrix(geo.grad)};});
 for(const e of elements)for(let k=0;k<3;k++){const f=(properties.density??0)*e.volume*gravity[k];bodyLoadN[k]+=f;for(const node of e.nodes)external[3*node+k]+=f/4;}
 const force=toLocal(external,bases),u=new Float64Array(n),history=[];let committed=elements.map(()=>({plasticStrain:Array(6).fill(0),equivalentPlasticStrain:0})),committedReference=1e-9;
 function assemble(local,scale,tangent){const global=toGlobal(local,bases),internal=new Float64Array(n),entries=[],states=[];let elasticEnergyJ=0,hardeningEnergyJ=0,plasticDissipationJ=0;
 for(let ei=0;ei<elements.length;ei++){const e=elements[ei],strain=e.B.map(row=>dot(row,e.ids.map(i=>global[i]))),state=j2Return(strain,properties,committed[ei],{tangent});state.strain=strain;states.push(state);elasticEnergyJ+=state.elasticEnergy*e.volume;hardeningEnergyJ+=state.hardeningEnergy*e.volume;plasticDissipationJ+=state.plasticDissipation*e.volume;
 for(let i=0;i<12;i++)internal[e.ids[i]]+=e.volume*e.B.reduce((sum,row,a)=>sum+row[i]*state.stress[a],0);
 if(tangent){const DB=state.tangent.map(row=>Array.from({length:12},(_,j)=>row.reduce((sum,v,a)=>sum+v*e.B[a][j],0))),k=new Float64Array(144);for(let i=0;i<12;i++)for(let j=0;j<12;j++)k[i*12+j]=e.volume*e.B.reduce((sum,row,a)=>sum+row[i]*DB[a][j],0);entries.push({ids:e.ids,k:transformStiffness(e.nodes,k,bases)});}}
 const localInternal=toLocal(internal,bases),residual=Float64Array.from(localInternal,(v,i)=>v-scale*force[i]);let norm2=0,ref2=0;for(let i=0;i<n;i++)if(!fixed.has(i)){norm2+=residual[i]**2;ref2+=(scale*force[i])**2;}const reactionScale=Math.sqrt(localInternal.reduce((sum,v,i)=>sum+(fixed.has(i)?v*v:0),0));return {entries,states,residual,norm:Math.sqrt(norm2),reference:Math.max(Math.sqrt(ref2),reactionScale,scale===0?committedReference:1e-9),elasticEnergyJ,hardeningEnergyJ,plasticDissipationJ};}
 function principalStrainMaximum(states){return Math.max(...states.flatMap(s=>principalStresses([s.strain[0],s.strain[1],s.strain[2],s.strain[3]/2,s.strain[4]/2,s.strain[5]/2]).map(Math.abs)));}
 function checkSmallStrain(states){const maximum=principalStrainMaximum(states);if(maximum>0.02+1e-12)throw Error('Plasticity small-strain limit exceeded: maximum absolute principal strain must be <= 0.02');return maximum;}
 let state,totalNewton=0,totalCG=0;
 for(let step=1;step<=loadSteps;step++){const scale=loadFractions[step-1];for(const [i,v] of dirichlet)u[i]=scale*v;let converged=false;
 for(let iteration=0;iteration<maxNewtonIterations;iteration++){state=assemble(u,scale,true);const relative=state.norm/state.reference;if(relative<1e-8){history.push({step,loadFraction:scale,newtonIterations:iteration,residual:relative,maxEquivalentPlasticStrain:Math.max(...state.states.map(s=>s.equivalentPlasticStrain)),elasticEnergyJ:state.elasticEnergyJ,hardeningEnergyJ:state.hardeningEnergyJ,plasticDissipationJ:state.plasticDissipationJ});converged=true;break;}
 const rhs=Float64Array.from(state.residual,(v,i)=>fixed.has(i)?0:-v),correction=pcg(n,state.entries,rhs,zero,{tolerance:1e-10,maxIterations:2500,matvecFactory});totalCG+=correction.iterations;let accepted=false;
 for(let attempt=0;attempt<20;attempt++){const alpha=2**(-attempt),trial=Float64Array.from(u,(v,i)=>v+alpha*correction.solution[i]),candidate=assemble(trial,scale,false);if(candidate.norm<state.norm*(1-1e-4*alpha)){u.set(trial);accepted=true;break;}}
 if(!accepted)throw Error('Plasticity Newton line search failed; reduce load or increase load steps');totalNewton++;}
 if(!converged)throw Error('Plasticity Newton iteration limit reached; no converged result returned');checkSmallStrain(state.states);committed=state.states;committedReference=state.reference;onObserve?.({stage:'load-step',kind:'plasticity',step,steps:loadSteps,converged:true,metrics:history.at(-1),...(observeFields?{field:{kind:'structuralDisplacement',solver:'plasticity',step,steps:loadSteps,loadFactor:scale,displacement:Array.from(toGlobal(u,bases),v=>v*1000),units:{displacement:'mm'}}}:{})});onProgress('Plasticity load step '+step+'/'+loadSteps+' converged');}
 // Preserve the converged final state rather than performing another constitutive update.
 const global=toGlobal(u,bases),stresses=state.states.map(s=>s.stress),strains=state.states.map(s=>s.strain);
 const maxPrincipalStrain=checkSmallStrain(state.states);
 const vonMises=stresses.map(equivalent),localReaction=Float64Array.from(state.residual,(v,i)=>fixed.has(i)?v:0),globalReaction=toGlobal(localReaction,bases),reaction=[0,0,0],applied=[0,0,0],constraintReactions=[];
 for(let node=0;node<n/3;node++){for(let k=0;k<3;k++){reaction[k]+=globalReaction[node*3+k];applied[k]+=finalFraction*external[node*3+k];}if([0,1,2].some(k=>fixed.has(node*3+k)))constraintReactions.push({node,force:Array.from(globalReaction.slice(node*3,node*3+3))});}
 const constraintRegionReactions=(boundary.reports||[]).filter(r=>r.nodes).map(r=>{const force=r.nodes.reduce((sum,node)=>sum.map((v,k)=>v+globalReaction[node*3+k]),[0,0,0]),direction=r.direction?.map(v=>v/Math.hypot(...r.direction));return {conditionIndex:r.conditionIndex,type:r.type,valueMm:r.valueMm,force,directionalReactionN:direction?dot(force,direction):null,includesSharedNodes:true};}),displacement=Array.from(global,v=>v*1000),magnitudes=Array.from({length:n/3},(_,i)=>Math.hypot(...displacement.slice(i*3,i*3+3))),p=properties.plasticity;
 return {kind:'elastic',engine:'Airpocket small-strain J2 Tet4 / '+(matvecFactory?'WASM CPU':'JavaScript CPU'),method,displacement,magnitudes,stresses,strains,vonMises,principal:stresses.map(principalStresses),reaction,applied,bodyLoadN:bodyLoadN.map(v=>v*finalFraction),forceBalanceErrorN:reaction.map((v,k)=>v+applied[k]),constraintReactions,constraintRegionReactions,iterations:totalCG,residual:state.norm/state.reference,maxDisplacementMm:Math.max(...magnitudes),maxVonMisesPa:Math.max(...vonMises),plasticity:{model:p.model,yieldStressPa:p.yieldStress,hardeningModulusPa:p.hardeningModulus,loadSteps,...(requestedFractions!==undefined?{loadFractions:loadFractions.slice()}:{}),newtonIterations:totalNewton,history,plasticStrain:committed.map(s=>s.plasticStrain),equivalentPlasticStrain:committed.map(s=>s.equivalentPlasticStrain),maxEquivalentPlasticStrain:Math.max(...committed.map(s=>s.equivalentPlasticStrain)),smallStrain:true,strainLimit:0.02,maxPrincipalStrain}};
}
