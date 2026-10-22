import {solveElastic} from '../../src/fem-core.js';

export function syntheticIncrementUiBundle(){
 const mesh={nodes:[0,0,0,10,0,0,0,10,0,0,0,10],tetrahedra:[[0,1,2,3]]},input={study:{kind:'structural'},materialProperties:{youngModulus:1e9,poissonRatio:0}},rowIdentity={materialKey:'synthetic-E1e9',geometryKey:'unit-tet',gaugeKey:'nodes0-3'};
 const spec={schemaVersion:1,curveId:'synthetic-ui-reference',caseIdentity:{name:'synthetic single tetrahedron',synthetic:true},rowIdentity,input,mesh,axis:[0,0,1],nodeCount:4,initialGaugeLengthMm:10,initialAreaMm2:50,fixedNodes:[0,1,2],loadedNodes:[3],gauge:{a:{nodes:[0],weights:[1]},b:{nodes:[3],weights:[1]}}};
 const steps=[0,10,15,20].map((force,index)=>{const base={stepId:'step'+index,controlledQuantity:'force',controlledValue:force,converged:index!==2,provisional:index===2,rowIdentity};return index===2?base:{...base,output:{input,mesh,calculation:{controlledQuantity:'force',controlledValue:force,controlledUnit:'N',plasticHistory:false},result:solveElastic(mesh,input.materialProperties,{fixed:[0,1,2],forces:[{node:3,value:[0,0,force]}]})}};});
 return {spec,steps};
}
