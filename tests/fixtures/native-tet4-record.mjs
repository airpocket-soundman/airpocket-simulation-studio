import {createProjectFromBuiltin} from '../../src/project-import.js';
import {createNativeTet4Record} from '../../scripts/native-tet4-contract.mjs';
// Saved synthetic input plus explicit, already-prepared mesh/boundary data.
export async function nativeTet4Fixture({load=75,nu=0}={}){
 const nodes=[0,0,0,20,0,0,20,15,0,0,15,0,0,0,60,20,0,60,20,15,60,0,15,60].map((x,i)=>x+[7,-3,11][i%3]);
 const mesh={nodes,tets:[[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]]};
 const input=createProjectFromBuiltin({source:{kind:'box',bounds:[7,-3,11,20,15,60]},name:'synthetic translated 20x15x60 mm bar',study:{kind:'structural',gravityEnabled:false},materialProperties:{youngModulus:2e9,poissonRatio:nu}});
 const forces=Array(24).fill(0);for(const [node,share] of [[4,1/3],[5,1/6],[6,1/3],[7,1/6]])forces[3*node+2]=load*share;
 return {input,mesh,fixedNodes:[0,1,2,3],forces,record:await createNativeTet4Record({input,mesh,fixedNodes:[0,1,2,3],forces})};
}
