import {createProjectFromBuiltin} from '../../src/project-import.js';
export function printedEquivalentFixture(){
 const project=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]},name:'Synthetic printed-equivalent contract fixture'});
 const orthotropic={model:'linear-orthotropic',youngModuliPa:[1e9,2e9,3e9],poissonRatios:[0,0,0],shearModuliPa:[4e8,5e8,6e8],axes:[[1,0,0],[0,1,0],[0,0,1]],source:'Synthetic theory, not measured printing data',testConditions:'Analytical 10x10x40 mm bar; zero Poisson ratios'};
 const constants=Object.fromEntries(['youngModuliPa','poissonRatios','shearModuliPa','axes'].map(k=>[k,structuredClone(orthotropic[k])]));
 const printedEquivalent={schemaVersion:1,model:'equivalent-orthotropic',id:'synthetic-assumption-v1',units:{length:'mm',modulus:'Pa',direction:'1',temperature:'degC',strainRate:'1/s',fraction:'1'},specimen:{id:'synthetic-specimen-1',dimensionsMm:[10,10,40]},material:{name:'Synthetic polymer',batch:'synthetic-no-physical-batch'},printer:{model:'synthetic-no-real-printer'},print:{buildDirection:[0,0,1],layerHeightMm:.2,wallCount:2,wallThicknessMm:null,infillFraction:.2,infillPattern:'synthetic-grid'},constants,basis:{kind:'assumed',source:'Synthetic theoretical constants; no physical print or measured data',identification:null,independentValidation:null},validity:{temperatureRangeC:[15,25],strainRateRangePerSecond:[0,1],layerHeightRangeMm:[.15,.25],infillFractionRange:[.1,.3]}};
 project.materialProperties={orthotropic,printedEquivalent};project.study={kind:'structural',gravityEnabled:false,materialTemperature:20};
 const positions=project.meshes[0].positions,face=z=>project.meshes[0].faceIds.flatMap((_,i)=>[2,5,8].every(k=>Math.abs(positions[9*i+k]-z)<1e-7)?[i]:[]);
 project.conditions=[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}];return project;
}
