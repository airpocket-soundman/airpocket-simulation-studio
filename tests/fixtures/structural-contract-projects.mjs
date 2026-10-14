import {createProjectFromBuiltin} from '../../src/project-import.js';
import {preflightProject} from '../../src/analysis-preflight.js';
import {createInputProvenance} from '../../src/input-provenance.js';
export function structuralContractProject(kind='modal'){
 const p=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}}),positions=p.meshes[0].positions;
 const face=z=>Array.from({length:positions.length/9},(_,i)=>i).filter(i=>[2,5,8].every(k=>Math.abs(positions[i*9+k]-z)<1e-8));
 p.study={kind:'structural',gravityEnabled:false};p.conditions=[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:face(0)}]}];
 if(kind==='modal'){Object.assign(p.study,{modalAnalysis:true,modeCount:1,modalIterations:60});p.materialProperties={youngModulus:1e9,poissonRatio:0,density:1000};}
 else{p.materialProperties={orthotropic:{model:'linear-orthotropic',youngModuliPa:[1e9,2e9,3e9],poissonRatios:[0,0,0],shearModuliPa:[4e8,5e8,6e8],axes:[[1,0,0],[0,1,0],[0,0,1]],source:'Synthetic axial reference, not measured material data',testConditions:'10 x 10 x 40 mm bar, 100 N axial force, zero Poisson ratios'}};p.conditions.push({type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]});}return p;
}
export function documentStructuralContract(p,mode='quantitative'){
 p.analysisIntent={mode};const pointers=preflightProject(p).requiredPointers;
 p.inputProvenance=createInputProvenance(pointers.map(pointer=>({pointer,value:pointer.slice(1).split('/').reduce((value,key)=>value[key],p),source:{kind:mode==='exploratory'?'agent-proposal':'user-input'},rationale:'Explicit synthetic reference input',applicability:'Limited CPU reference; no measured material calibration',status:mode==='exploratory'?'unconfirmed':'confirmed',assumption:mode==='exploratory'?'Explicit unverified reference assumption':null})));return p;
}
