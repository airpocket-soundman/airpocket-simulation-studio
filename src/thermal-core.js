import {elementGeometry,pcg} from './fem-core.js';
import {meshComponents} from './components.js';
export function solveThermal(mesh,properties,boundary,{matvecFactory,method,transient=false,timeStep=1,steps=10,initialTemperature=20,volumetricSource=0}={}){
 const k=properties.conductivity;if(!(k>0)||!Number.isFinite(k))throw Error('Positive thermal conductivity required');
 if(!boundary.temperatures?.length)throw Error('At least one prescribed temperature region required');
 if(!Number.isFinite(volumetricSource)||!Number.isFinite(initialTemperature)||initialTemperature<-273.15)throw Error('Invalid thermal inputs');
 if(transient&&(!(properties.density>0)||!(properties.specificHeat>0)||!(timeStep>0)||!Number.isInteger(steps)||steps<1||steps>100))throw Error('Transient heat requires density, specific heat and valid time limits');
 const n=mesh.nodes.length/3,load=new Float64Array(n),mass=new Float64Array(n),entries=[],gradients=[];
 for(const [node,value]of boundary.heatFlux||[])load[node]+=value;
 for(const t of mesh.tetrahedra){const g=elementGeometry(mesh,t),a=new Float64Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)a[i*4+j]=k*g.volume*g.grad[i].reduce((s,v,d)=>s+v*g.grad[j][d],0);entries.push({ids:t,k:a});gradients.push(g.grad);for(const i of t){load[i]+=volumetricSource*g.volume/4;mass[i]+=(properties.density||0)*(properties.specificHeat||0)*g.volume/4;}}
 const temperatures=new Map(boundary.temperatures);for(const [i,v]of temperatures)if(!Number.isFinite(v)||v<-273.15)throw Error('Invalid prescribed temperature');
 if(!transient)for(const component of meshComponents(mesh))if(!component.some(i=>temperatures.has(i)))throw Error('Each disconnected solid needs a prescribed temperature for steady heat conduction');
 let field=new Float64Array(n).fill(initialTemperature),solveResult,lastPrevious=field;const history=[];
 const system=transient?entries.map(({ids,k:matrix},e)=>{const matrix2=matrix.slice(),geo=elementGeometry(mesh,mesh.tetrahedra[e]),localMass=properties.density*properties.specificHeat*geo.volume/4/timeStep;for(let i=0;i<4;i++)matrix2[i*4+i]+=localMass;return {ids,k:matrix2};}):entries;
 const count=transient?steps:1;
 for(let step=0;step<count;step++){const rhs=transient?Float64Array.from(load,(v,i)=>v+mass[i]*field[i]/timeStep):load;const previous=field;lastPrevious=previous;solveResult=pcg(n,system,rhs,temperatures,{matvecFactory,tolerance:method==='pcg-strict'?1e-10:1e-8});field=solveResult.solution;const storedEnergy=transient?field.reduce((s,v,i)=>s+mass[i]*(v-previous[i]),0):0;history.push({time:transient?(step+1)*timeStep:0,minTemperature:Math.min(...field),maxTemperature:Math.max(...field),storedEnergyJ:storedEnergy,residual:solveResult.residual});}
 const flux=mesh.tetrahedra.map((t,e)=>[0,1,2].map(d=>-k*t.reduce((s,i,a)=>s+gradients[e][a][d]*field[i],0)));
 const conduction=new Float64Array(n);for(const {ids,k:matrix}of entries)for(let i=0;i<4;i++)for(let j=0;j<4;j++)conduction[ids[i]]+=matrix[i*4+j]*field[ids[j]];
 const storageRate=transient?field.reduce((sum,v,i)=>sum+mass[i]*(v-lastPrevious[i])/timeStep,0):0;
 const reactionHeatW=[...temperatures.keys()].reduce((sum,i)=>sum+conduction[i]-load[i]+(transient?mass[i]*(field[i]-lastPrevious[i])/timeStep:0),0),appliedHeatW=load.reduce((sum,v)=>sum+v,0);
 return {kind:'thermal',engine:matvecFactory?'Airpocket Heat Tet4 / WASM CPU':'Airpocket Heat Tet4 / JavaScript CPU',temperature:Array.from(field),flux,history,transient,iterations:solveResult.iterations,residual:solveResult.residual,minTemperature:Math.min(...field),maxTemperature:Math.max(...field),reactionHeatW,appliedHeatW,storageRateW:storageRate,energyBalanceErrorW:appliedHeatW+reactionHeatW-storageRate};
}
