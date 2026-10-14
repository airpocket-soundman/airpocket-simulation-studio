import {structuralContractProject,documentStructuralContract} from './structural-contract-projects.mjs';import {advancedStructuralProject,documentAdvancedStructural} from './advanced-structural-projects.mjs';
export function executionFailureProject(kind){
 let p=structuralContractProject('orthotropic');p.materialProperties={youngModulus:1e9,poissonRatio:0};
 if(kind==='rank')p.conditions=[{...p.conditions[0],type:'displacement',direction:[0,0,1]}];
 if(kind==='conflict')p.conditions.push({...p.conditions[0],type:'displacement',value:.1,direction:[0,0,1]});
 if(kind==='boundary')p.meshes[0].positions=p.meshes[0].positions.map((v,i)=>i%3===0?v+100:v);
 if(kind==='solve'){p=advancedStructuralProject('hyperelastic');p.study.maxNewtonIterations=1;}
 if(kind==='temperature'){p=advancedStructuralProject('thermalStress');p.study.temperatureSource={name:'Intentional incomplete synthetic transfer field',mesh:{nodes:[0,0,0,10,0,0,0,10,0,0,0,40],tetrahedra:[[0,1,2,3]]},temperature:[80,80,80,80]};}
 return documentAdvancedStructural(p,'exploratory');
}
