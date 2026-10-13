import {stokesBoundary} from './stokes-study.js';
import {elementGeometry} from './fem-core.js';
import {outwardSurfaceNormals} from './surface-loads.js';
import {meshComponents} from './components.js';

export function validateStokesResult(mesh,result,input,calculation){
 const expected=input?.study?.kind==='creepingFlow',present=result?.kind==='stokes';
 if(!expected&&!present){if(result?.stokes!==undefined)throw Error('Unexpected saved Stokes metadata');return;}
 if(!expected||!present||!result.stokes||input.conditions?.length||calculation?.options?.adaptive||!['pcg','pcg-strict','wasm-pcg'].includes(calculation?.options?.method)||result.method!==(calculation.options.method==='wasm-pcg'?'wasm-gmres':'js-gmres')||result.native||result.gpu||result.fatigue||result.plasticity||result.hyperelastic)throw Error('Invalid saved Stokes study or execution mode');
 const n=mesh?.nodes?.length/3,e=mesh?.tetrahedra?.length,vector=(v,length)=>Array.isArray(v)&&v.length===length&&v.every(Number.isFinite);
 if(!Number.isInteger(n)||n<4||n>2000||!Number.isInteger(e)||e<1||e>8000||!vector(result.velocity,3*n)||!vector(result.speed,n)||!vector(result.pressure,n)||!vector(result.divergence,e)||!Array.isArray(result.stresses)||result.stresses.length!==e||!result.stresses.every(s=>vector(s,6)))throw Error('Invalid saved Stokes fields');
 const boundary=stokesBoundary(mesh,input.sourceModel,input.study),p=result.stokes,study=input.study,L=boundary.referenceLengthMm*.001,U=Math.hypot(...study.freeStreamVelocity),mu=study.dynamicViscosity,rho=study.fluidDensity;
 if(typeof mesh.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(mesh.sourceHash)||input.meshes?.some(display=>display.kind==='gmsh-surface'&&display.sourceHash!==mesh.sourceHash))throw Error('Saved Stokes display fingerprint does not match its fluid mesh');
 const close=(a,b,scale=1)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-12*Math.abs(scale)+2e-7*Math.max(Math.abs(a),Math.abs(b));
 const sameVector=(a,b,scale)=>vector(a,b.length)&&a.every((v,i)=>close(v,b[i],scale));
 if(p.model!=='steady-creeping-flow'||p.velocityElement!=='P1'||p.pressureElement!=='P1'||p.stabilization!=='PSPG h^2/(12 mu)'||p.linearSolver!=='equilibrated ILU(0) restarted GMRES'||p.inertiaIncluded!==false||p.dynamicViscosity!==mu||p.density!==rho||!sameVector(p.referenceVelocity,study.freeStreamVelocity,U)||!close(p.referenceLengthMm,boundary.referenceLengthMm,boundary.referenceLengthMm)||JSON.stringify(p.bodyFaceTags)!==JSON.stringify(boundary.bodyFaceTags)||p.pressureGauge?.node!==boundary.pressureGauge.node||p.pressureGauge?.valuePa!==0||!close(p.reynoldsNumber,rho*U*L/mu)||p.reynoldsNumber>.1+1e-12)throw Error('Saved Stokes metadata does not match its input');
 for(const [node,velocity] of boundary.velocity)if(!sameVector(result.velocity.slice(3*node,3*node+3),velocity,U))throw Error('Saved Stokes velocity does not match its boundary');
 if(!close(result.pressure[boundary.pressureGauge.node],0,mu*U/L))throw Error('Saved Stokes pressure gauge mismatch');
 const speeds=Array.from({length:n},(_,i)=>Math.hypot(...result.velocity.slice(3*i,3*i+3))),maxSpeed=Math.max(...speeds),maxRe=rho*maxSpeed*L/mu;
 if(!result.speed.every((v,i)=>close(v,speeds[i],U))||!close(result.maxSpeedMs,maxSpeed,U)||!close(result.minPressurePa,Math.min(...result.pressure),mu*U/L)||!close(result.maxPressurePa,Math.max(...result.pressure),mu*U/L)||!close(p.maxReynoldsNumber,maxRe)||maxRe>.1+1e-12||!Number.isFinite(result.residual)||result.residual<0||result.residual>1e-8||!Number.isInteger(result.iterations)||result.iterations<0||result.iterations>3000)throw Error('Invalid saved Stokes extrema or convergence');
 const components=meshComponents(mesh);if(components.length!==1||components[0].length!==n)throw Error('Saved Stokes fluid mesh must be connected without unused nodes');
 const adjacent=new Map(),key=nodes=>nodes.slice().sort((a,b)=>a-b).join(','),internal=Array(3*n).fill(0),bodyNodes=new Set(mesh.surface.filter(f=>boundary.bodyFaceTags.includes(f.faceTag)).flatMap(f=>f.nodes));
 let volume=0,div2=0,integratedDiv=0;
 for(let i=0;i<e;i++){
  const nodes=mesh.tetrahedra[i];if(!Array.isArray(nodes)||nodes.length!==4||new Set(nodes).size!==4||!nodes.every(node=>Number.isInteger(node)&&node>=0&&node<n))throw Error('Invalid saved Stokes tetrahedron');
  const geometry=elementGeometry(mesh,nodes),gradient=Array.from({length:3},(_,a)=>Array.from({length:3},(_,b)=>nodes.reduce((sum,node,j)=>sum+result.velocity[3*node+a]*geometry.grad[j][b],0))),pressure=nodes.reduce((sum,node)=>sum+result.pressure[node]/4,0),tensor=gradient.map((row,a)=>row.map((v,b)=>mu*(v+gradient[b][a])-(a===b?pressure:0))),stress=[tensor[0][0],tensor[1][1],tensor[2][2],tensor[0][1],tensor[1][2],tensor[0][2]],div=gradient[0][0]+gradient[1][1]+gradient[2][2];
  if(!sameVector(result.stresses[i],stress,mu*U/L)||!close(result.divergence[i],div,U/L))throw Error('Saved Stokes stress or divergence does not match its fields');
  volume+=geometry.volume;div2+=div*div*geometry.volume;integratedDiv+=div*geometry.volume;
  nodes.forEach((node,j)=>{for(let a=0;a<3;a++)internal[3*node+a]+=geometry.volume*tensor[a].reduce((sum,v,b)=>sum+v*geometry.grad[j][b],0);});
  for(let opposite=0;opposite<4;opposite++){const face=key(nodes.filter((_,j)=>j!==opposite));adjacent.set(face,adjacent.has(face)?-1:i);}
 }
 const normals=outwardSurfaceNormals(mesh),surfaceKeys=new Set(),drag=[0,0,0],bodyReaction=[0,0,0],outerReaction=[0,0,0];let flux=0,absoluteFlux=0;
 mesh.surface.forEach((face,i)=>{
  const faceKey=key(face.nodes),cell=adjacent.get(faceKey);if(surfaceKeys.has(faceKey)||!(cell>=0))throw Error('Invalid saved Stokes boundary surface');surfaceKeys.add(faceKey);
  const points=face.nodes.map(node=>mesh.nodes.slice(3*node,3*node+3).map(v=>v*.001)),a=points[1].map((v,k)=>v-points[0][k]),b=points[2].map((v,k)=>v-points[0][k]),area=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/2,normal=normals[i],average=[0,1,2].map(k=>face.nodes.reduce((sum,node)=>sum+result.velocity[3*node+k]/3,0)),f=average.reduce((sum,v,k)=>sum+v*normal[k],0)*area;flux+=f;absoluteFlux+=Math.abs(f);
  if(boundary.bodyFaceTags.includes(face.faceTag)){const s=result.stresses[cell],dp=mesh.tetrahedra[cell].reduce((sum,node)=>sum+result.pressure[node]/4,0)-face.nodes.reduce((sum,node)=>sum+result.pressure[node]/3,0),tensor=[[s[0]+dp,s[3],s[5]],[s[3],s[1]+dp,s[4]],[s[5],s[4],s[2]+dp]];for(let k=0;k<3;k++)drag[k]-=tensor[k].reduce((sum,v,j)=>sum+v*normal[j],0)*area;}
 });
 if(surfaceKeys.size!==[...adjacent.values()].filter(i=>i>=0).length)throw Error('Saved Stokes boundary surface is incomplete');
 for(const node of boundary.velocity.keys())for(let k=0;k<3;k++)if(bodyNodes.has(node))bodyReaction[k]-=internal[3*node+k];else outerReaction[k]+=internal[3*node+k];
 const forceScale=mu*U*L;
 if(!sameVector(result.dragN,drag,forceScale)||!sameVector(result.reactionDragN,bodyReaction,forceScale)||!sameVector(result.outerReactionN,outerReaction,forceScale)||!sameVector(result.forceBalanceErrorN,outerReaction.map((v,k)=>v-bodyReaction[k]),forceScale))throw Error('Saved Stokes forces do not match their physical fields');
 if(!close(result.fluxM3s,flux,U*L*L)||!close(result.absoluteFluxM3s,absoluteFlux,U*L*L)||!close(result.relativeFluxError,absoluteFlux?Math.abs(flux)/absoluteFlux:0)||!close(result.integratedDivergenceM3s,integratedDiv,U*L*L)||!close(result.rmsDivergencePerSecond,Math.sqrt(div2/volume),U/L)||result.absoluteFluxM3s<0||result.relativeFluxError<0||result.rmsDivergencePerSecond<0)throw Error('Saved Stokes diagnostics do not match their fields');
}
