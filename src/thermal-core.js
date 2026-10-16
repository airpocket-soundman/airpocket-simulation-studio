import {validateRadiationFace,radiationTerms,solveRadiatingSystem} from './thermal-radiation.js';
import {elementGeometry,pcg} from './fem-core.js';
import {meshComponents} from './components.js';
export const THERMAL_SNAPSHOT_DEFAULT=61,THERMAL_SNAPSHOT_MAX=61,THERMAL_SNAPSHOT_BUDGET_BYTES=64*1024*1024;
/** Evenly spaced stored-step indices 0..steps (0 is the initial state), first and last always included. Pure; exported for tests. */
export function thermalSnapshotPlan(steps,n,requested,budgetBytes=THERMAL_SNAPSHOT_BUDGET_BYTES){
 if(requested!==undefined&&(!Number.isInteger(requested)||requested<2||requested>THERMAL_SNAPSHOT_MAX))throw Error('thermalSnapshotCount must be an integer from 2 through '+THERMAL_SNAPSHOT_MAX);
 if(!Number.isFinite(budgetBytes)||budgetBytes<=0)throw Error('Invalid thermal snapshot budget');
 const warnings=[],wanted=requested??THERMAL_SNAPSHOT_DEFAULT;let count=Math.min(wanted,steps+1);
 if(count<wanted&&requested!==undefined)warnings.push('Requested '+wanted+' snapshots but only '+(steps+1)+' states exist (initial plus '+steps+' steps); storing '+count);
 const fit=Math.floor(budgetBytes/(8*n));
 if(fit<2)throw Error('Thermal snapshot memory budget of '+budgetBytes+' bytes cannot hold two frames of '+n+' nodes');
 if(count>fit){warnings.push('Snapshot count reduced from '+count+' to '+fit+' to stay within the '+budgetBytes+' byte budget');count=fit;}
 const indices=Array.from({length:count},(_,i)=>i===count-1?steps:Math.round(i*steps/(count-1)));
 return {requested:requested??null,count,indices:[...new Set(indices)],bytes:count*n*8,budgetBytes,warnings};
}
export function solveThermal(mesh,properties,boundary,{matvecFactory,method,transient=false,timeStep=1,steps=10,initialTemperature=20,volumetricSource=0,maxRadiationIterations=30,onObserve,observeFields=true,thermalSnapshotCount,thermalSnapshotBudgetBytes=THERMAL_SNAPSHOT_BUDGET_BYTES}={}){
 const k=properties.conductivity;if(!(k>0)||!Number.isFinite(k))throw Error('Positive thermal conductivity required');
 if(!Number.isFinite(volumetricSource)||!Number.isFinite(initialTemperature)||initialTemperature<-273.15)throw Error('Invalid thermal inputs');
 if(transient&&(![properties.density,properties.specificHeat,timeStep].every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(steps)||steps<1||steps>100))throw Error('Transient heat requires density, specific heat and valid time limits');
 const n=mesh.nodes.length/3,load=new Float64Array(n),mass=new Float64Array(n),entries=[],gradients=[],convection=boundary.convection||[],radiation=boundary.radiation||[],contacts=boundary.contacts||[],anchors=new Set();
 for(const [node,value]of boundary.heatFlux||[])load[node]+=value;
 for(const t of mesh.tetrahedra){const g=elementGeometry(mesh,t),a=new Float64Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)a[i*4+j]=k*g.volume*g.grad[i].reduce((s,v,d)=>s+v*g.grad[j][d],0);entries.push({ids:t,k:a});gradients.push(g.grad);for(const i of t){load[i]+=volumetricSource*g.volume/4;mass[i]+=(properties.density||0)*(properties.specificHeat||0)*g.volume/4;}}
 for(const c of contacts){if(!Array.isArray(c.ids)||c.ids.length!==6||new Set(c.ids).size!==6||!c.ids.every(i=>Number.isInteger(i)&&i>=0&&i<n)||!Array.isArray(c.k)||c.k.length!==36||!c.k.every(Number.isFinite))throw Error('Invalid thermal contact matrix');entries.push(c);}
 const appliedHeatW=load.reduce((sum,v)=>sum+v,0);
 for(const face of convection){const {nodes:ids,areaM2:area,coefficient:h,ambientTemperature:ambient}=face;if(!Array.isArray(ids)||ids.length!==3||!ids.every(i=>Number.isInteger(i)&&i>=0&&i<n)||![area,h,ambient].every(Number.isFinite)||area<=0||h<=0||ambient<-273.15)throw Error('Invalid convection boundary');const matrix=new Float64Array(9);for(let i=0;i<3;i++){anchors.add(ids[i]);load[ids[i]]+=h*area*ambient/3;for(let j=0;j<3;j++)matrix[i*3+j]=h*area*(i===j?2:1)/12;}entries.push({ids,k:matrix});}
 for(const face of radiation){validateRadiationFace(face,n);face.nodes.forEach(i=>anchors.add(i));}
 const temperatures=new Map(boundary.temperatures||[]);for(const [i,v]of temperatures)if(!Number.isInteger(i)||i<0||i>=n||!Number.isFinite(v)||v<-273.15)throw Error('Invalid prescribed temperature');
 if(!transient)for(const component of meshComponents({...mesh,tetrahedra:[...mesh.tetrahedra,...contacts.map(c=>c.ids)]}))if(!component.some(i=>temperatures.has(i)||anchors.has(i)))throw Error('Each disconnected solid needs a temperature, convection or radiation boundary for steady heat conduction');
 let field=new Float64Array(n).fill(initialTemperature),solveResult,lastPrevious=field;const history=[];const plan=transient?thermalSnapshotPlan(steps,n,thermalSnapshotCount,thermalSnapshotBudgetBytes):null,wantStep=plan?new Set(plan.indices):null,snapshots=[];if(plan&&wantStep.has(0))snapshots.push({step:0,time:0,temperature:Array.from(field)});
 const system=transient?[...entries,...Array.from(mass,(m,i)=>({ids:[i],k:[m/timeStep]}))]:entries;
 const convectionRate=values=>convection.reduce((sum,f)=>sum+f.coefficient*f.areaM2*(f.ambientTemperature-f.nodes.reduce((s,i)=>s+values[i]/3,0)),0);
 for(let step=0;step<(transient?steps:1);step++){const rhs=transient?Float64Array.from(load,(v,i)=>v+mass[i]*field[i]/timeStep):load;const previous=field;lastPrevious=previous;solveResult=radiation.length?solveRadiatingSystem(n,system,rhs,temperatures,radiation,field,{matvecFactory,method,maxRadiationIterations}):pcg(n,system,rhs,temperatures,{matvecFactory,tolerance:method==='pcg-strict'?1e-10:1e-8});field=solveResult.solution;const storedEnergy=transient?field.reduce((s,v,i)=>s+mass[i]*(v-previous[i]),0):0;history.push({time:transient?(step+1)*timeStep:0,minTemperature:Math.min(...field),maxTemperature:Math.max(...field),storedEnergyJ:storedEnergy,radiationHeatW:-radiationTerms(n,radiation,field,false).outwardHeatW,nonlinearIterations:solveResult.nonlinearIterations??0,convectionHeatW:convectionRate(field),residual:solveResult.residual});if(wantStep?.has(step+1))snapshots.push({step:step+1,time:history.at(-1).time,temperature:Array.from(field)});onObserve?.({stage:'time-step',kind:'thermal',step:step+1,steps:transient?steps:1,time:history.at(-1).time,timeUnit:'s',converged:true,metrics:history.at(-1),...(observeFields!==false?{field:{kind:'thermal',time:history.at(-1).time,temperature:Array.from(field),units:{temperature:'degC'}}}:{})});}
 const flux=mesh.tetrahedra.map((t,e)=>[0,1,2].map(d=>-k*t.reduce((s,i,a)=>s+gradients[e][a][d]*field[i],0)));
 const internal=new Float64Array(n);for(const {ids,k:matrix}of entries)for(let i=0;i<ids.length;i++)for(let j=0;j<ids.length;j++)internal[ids[i]]+=matrix[i*ids.length+j]*field[ids[j]];
 const storageRate=transient?field.reduce((sum,v,i)=>sum+mass[i]*(v-lastPrevious[i])/timeStep,0):0,convectionHeatW=convectionRate(field);
 const radiationResult=radiationTerms(n,radiation,field,false),radiationHeatW=-radiationResult.outwardHeatW;
 const reactionHeatW=[...temperatures.keys()].reduce((sum,i)=>sum+internal[i]-load[i]+radiationResult.residual[i]+(transient?mass[i]*(field[i]-lastPrevious[i])/timeStep:0),0);
 const contactGroups=new Map();for(const c of contacts){let rate=0;for(let i=0;i<3;i++)for(let j=0;j<6;j++)rate+=c.k[i*6+j]*field[c.ids[j]];contactGroups.set(c.conditionIndex,(contactGroups.get(c.conditionIndex)||0)+rate);}
 const contactTransfers=[...contactGroups].map(([conditionIndex,fromAToBW])=>({conditionIndex,fromAToBW}));
 return {contactTransfers,kind:'thermal',...(plan?{snapshots,snapshotInfo:{requested:plan.requested,count:snapshots.length,steps:plan.indices,bytes:snapshots.length*n*8,budgetBytes:plan.budgetBytes,warnings:plan.warnings}}:{}),engine:matvecFactory?'Airpocket Heat Tet4 / WASM CPU':'Airpocket Heat Tet4 / JavaScript CPU',temperature:Array.from(field),flux,history,transient,iterations:solveResult.iterations,residual:solveResult.residual,minTemperature:Math.min(...field),maxTemperature:Math.max(...field),reactionHeatW,appliedHeatW,convectionHeatW,radiationHeatW,nonlinearIterations:solveResult.nonlinearIterations??0,storageRateW:storageRate,energyBalanceErrorW:appliedHeatW+convectionHeatW+radiationHeatW+reactionHeatW-storageRate};
}
