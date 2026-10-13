export function refinementIndicators(mesh,result){
 const nodal=new Float64Array(mesh.nodes.length/3),counts=new Uint32Array(nodal.length);mesh.tetrahedra.forEach((t,e)=>t.forEach(i=>{nodal[i]+=result.vonMises[e];counts[i]++;}));for(let i=0;i<nodal.length;i++)if(counts[i])nodal[i]/=counts[i];
 const maxStress=Math.max(...result.vonMises,1e-20),maxDisp=Math.max(...result.magnitudes,1e-20),maxStrain=Math.max(...result.strains.map(s=>Math.hypot(...s)),1e-20);
 return mesh.tetrahedra.map((t,e)=>{const center=[0,0,0];let recovered=0,disp=0;for(const i of t){for(let k=0;k<3;k++)center[k]+=mesh.nodes[i*3+k]/4;recovered+=nodal[i]/4;disp+=result.magnitudes[i]/4;}const variation=Math.abs(result.vonMises[e]-recovered)/maxStress,strain=Math.hypot(...result.strains[e])/maxStrain;return {element:e,center,variation,score:.55*variation+.3*strain+.15*disp/maxDisp};});
}
export async function adaptiveSolve({mesh,solve},{maxRounds=3,tolerance=.01,baseSize=5,onProgress=()=>{}}={}){
 if(!Number.isInteger(maxRounds)||maxRounds<1||maxRounds>5||!(tolerance>0&&tolerance<1))throw Error('Invalid adaptive limits');
 const history=[],refinements=[];let previous=null,last=null,converged=false;
 for(let round=0;round<maxRounds;round++){
 onProgress(`Adaptive round ${round+1}/${maxRounds}: meshing`);const m=await mesh({size:baseSize,refinements});onProgress(`Adaptive round ${round+1}/${maxRounds}: solving`);last=await solve(m);const indicators=refinementIndicators(m,last.result),variation=Math.max(...indicators.map(i=>i.variation)),u=last.result.maxDisplacementMm,change=previous===null?null:Math.abs(u-previous)/Math.max(Math.abs(u),1e-20);
 history.push({round:round+1,elements:m.tetrahedra.length,maxDisplacementMm:u,maxVonMisesPa:last.result.maxVonMisesPa,relativeDisplacementChange:change,stressVariationIndicator:variation,solverResidual:last.result.residual});
 if(change!==null&&change<tolerance&&variation<.2){converged=true;break;}
 previous=u;indicators.sort((a,b)=>b.score-a.score);const count=Math.max(1,Math.min(80,Math.ceil(indicators.length*.15)));for(const r of indicators.slice(0,count))refinements.push({center:r.center,radius:baseSize*1.5,size:Math.max(baseSize*.15,baseSize/2**(round+1))});
 }
 return {...last,adaptive:{converged,history,stopReason:converged?'output change and stress variation thresholds met':'maximum refinement rounds reached',indicator:'recovered stress variation, strain and displacement; not a certified error bound'}};
}
