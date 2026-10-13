import {elementGeometry,pcg} from './fem-core.js';
import {meshComponents} from './components.js';
export function solveThermal(mesh,properties,boundary,{matvecFactory,method,transient=false,timeStep=1,steps=10,initialTemperature=20,volumetricSource=0}={}){
 const k=properties.conductivity;if(!(k>0)||!Number.isFinite(k))throw Error('Positive thermal conductivity required');
 if(!Number.isFinite(volumetricSource)||!Number.isFinite(initialTemperature)||initialTemperature<-273.15)throw Error('Invalid thermal inputs');
 if(transient&&(![properties.density,properties.specificHeat,timeStep].every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(steps)||steps<1||steps>100))throw Error('Transient heat requires density, specific heat and valid time limits');
 const n=mesh.nodes.length/3,load=new Float64Array(n),mass=new Float64Array(n),entries=[],gradients=[],convection=boundary.convection||[],anchors=new Set();
 for(const [node,value]of boundary.heatFlux||[])load[node]+=value;
 for(const t of mesh.tetrahedra){const g=elementGeometry(mesh,t),a=new Float64Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)a[i*4+j]=k*g.volume*g.grad[i].reduce((s,v,d)=>s+v*g.grad[j][d],0);entries.push({ids:t,k:a});gradients.push(g.grad);for(const i of t){load[i]+=volumetricSource*g.volume/4;mass[i]+=(properties.density||0)*(properties.specificHeat||0)*g.volume/4;}}
 const appliedHeatW=load.reduce((sum,v)=>sum+v,0);
 for(const face of convection){const {nodes:ids,areaM2:area,coefficient:h,ambientTemperature:ambient}=face;if(!Array.isArray(ids)||ids.length!==3||!ids.every(i=>Number.isInteger(i)&&i>=0&&i<n)||![area,h,ambient].every(Number.isFinite)||area<=0||h<=0||ambient<-273.15)throw Error('Invalid convection boundary');const matrix=new Float64Array(9);for(let i=0;i<3;i++){anchors.add(ids[i]);load[ids[i]]+=h*area*ambient/3;for(let j=0;j<3;j++)matrix[i*3+j]=h*area*(i===j?2:1)/12;}entries.push({ids,k:matrix});}
 const temperatures=new Map(boundary.temperatures||[]);for(const [i,v]of temperatures)if(!Number.isInteger(i)||i<0||i>=n||!Number.isFinite(v)||v<-273.15)throw Error('Invalid prescribed temperature');
 if(!transient)for(const component of meshComponents(mesh))if(!component.some(i=>temperatures.has(i)||anchors.has(i)))throw Error('Each disconnected solid needs a temperature or convection boundary for steady heat conduction');
 let field=new Float64Array(n).fill(initialTemperature),solveResult,lastPrevious=field;const history=[];
 const system=transient?[...entries,...Array.from(mass,(m,i)=>({ids:[i],k:[m/timeStep]}))]:entries;
 const convectionRate=values=>convection.reduce((sum,f)=>sum+f.coefficient*f.areaM2*(f.ambientTemperature-f.nodes.reduce((s,i)=>s+values[i]/3,0)),0);
 for(let step=0;step<(transient?steps:1);step++){const rhs=transient?Float64Array.from(load,(v,i)=>v+mass[i]*field[i]/timeStep):load;const previous=field;lastPrevious=previous;solveResult=pcg(n,system,rhs,temperatures,{matvecFactory,tolerance:method==='pcg-strict'?1e-10:1e-8});field=solveResult.solution;const storedEnergy=transient?field.reduce((s,v,i)=>s+mass[i]*(v-previous[i]),0):0;history.push({time:transient?(step+1)*timeStep:0,minTemperature:Math.min(...field),maxTemperature:Math.max(...field),storedEnergyJ:storedEnergy,convectionHeatW:convectionRate(field),residual:solveResult.residual});}
 const flux=mesh.tetrahedra.map((t,e)=>[0,1,2].map(d=>-k*t.reduce((s,i,a)=>s+gradients[e][a][d]*field[i],0)));
 const internal=new Float64Array(n);for(const {ids,k:matrix}of entries)for(let i=0;i<ids.length;i++)for(let j=0;j<ids.length;j++)internal[ids[i]]+=matrix[i*ids.length+j]*field[ids[j]];
 const storageRate=transient?field.reduce((sum,v,i)=>sum+mass[i]*(v-lastPrevious[i])/timeStep,0):0,convectionHeatW=convectionRate(field);
 const reactionHeatW=[...temperatures.keys()].reduce((sum,i)=>sum+internal[i]-load[i]+(transient?mass[i]*(field[i]-lastPrevious[i])/timeStep:0),0);
 return {kind:'thermal',engine:matvecFactory?'Airpocket Heat Tet4 / WASM CPU':'Airpocket Heat Tet4 / JavaScript CPU',temperature:Array.from(field),flux,history,transient,iterations:solveResult.iterations,residual:solveResult.residual,minTemperature:Math.min(...field),maxTemperature:Math.max(...field),reactionHeatW,appliedHeatW,convectionHeatW,storageRateW:storageRate,energyBalanceErrorW:appliedHeatW+convectionHeatW+reactionHeatW-storageRate};
}
