import {elementGeometry} from './fem-core.js';
import {diagnoseConvergence} from './mesh-convergence.js';
export function refinementIndicators(mesh,result){
 const nodal=new Float64Array(mesh.nodes.length/3),counts=new Uint32Array(nodal.length);mesh.tetrahedra.forEach((t,e)=>t.forEach(i=>{nodal[i]+=result.vonMises[e];counts[i]++;}));for(let i=0;i<nodal.length;i++)if(counts[i])nodal[i]/=counts[i];
 const maxStress=Math.max(...result.vonMises,1e-20),maxDisp=Math.max(...result.magnitudes,1e-20),maxStrain=Math.max(...result.strains.map(s=>Math.hypot(...s)),1e-20);
 return mesh.tetrahedra.map((t,e)=>{const center=[0,0,0];let recovered=0,disp=0;for(const i of t){for(let k=0;k<3;k++)center[k]+=mesh.nodes[i*3+k]/4;recovered+=nodal[i]/4;disp+=result.magnitudes[i]/4;}const variation=Math.abs(result.vonMises[e]-recovered)/maxStress,strain=Math.hypot(...result.strains[e])/maxStrain;return {element:e,center,variation,score:.55*variation+.3*strain+.15*disp/maxDisp};});
}
export async function adaptiveSolve({mesh,solve},{maxRounds=3,tolerance=.01,stressTolerance=.05,baseSize=5,maxElements=30000,maxSeconds=110,onProgress=()=>{},now=()=>performance.now()}={}){
 if(!Number.isInteger(maxRounds)||maxRounds<1||maxRounds>5||![tolerance,stressTolerance].every(v=>Number.isFinite(v)&&v>0&&v<1)||!Number.isFinite(baseSize)||baseSize<=0||!Number.isInteger(maxElements)||maxElements<1||maxElements>30000||!Number.isFinite(maxSeconds)||maxSeconds<=0||maxSeconds>110)throw Error('Invalid adaptive limits');
 const history=[],iterations=[],refinements=[],started=now();let previous=null,last=null,converged=false,diagnostic,stopReason='maximum refinement rounds reached';
 for(let round=0;round<maxRounds;round++){
 if(last&&now()-started>=maxSeconds*1000){stopReason='time limit reached';break;}
 onProgress(`Adaptive round ${round+1}/${maxRounds}: meshing`);let m;try{m=await mesh({size:baseSize,refinements,maxElements});}catch(e){if(last&&/element limit|too fine for the browser limit/i.test(e.message)){stopReason='element limit reached';break;}throw e;}
 if(m.tetrahedra.length>maxElements){if(!last)throw Error('Initial mesh exceeds adaptive element limit');stopReason='element limit reached';break;}
 if(last&&m.tetrahedra.length<=history.at(-1).elements){stopReason='mesh refinement stalled';break;}
 if(last&&now()-started>=maxSeconds*1000){stopReason='time limit reached';break;}
 onProgress(`Adaptive round ${round+1}/${maxRounds}: solving`);last=await solve(m);const indicators=refinementIndicators(m,last.result),variation=Math.max(...indicators.map(i=>i.variation)),u=last.result.maxDisplacementMm,change=previous===null?null:Math.abs(u-previous)/Math.max(Math.abs(u),1e-20),peak=last.result.vonMises.indexOf(last.result.maxVonMisesPa),peakSizeMm=Math.cbrt(elementGeometry(m,m.tetrahedra[Math.max(0,peak)]).volume)*1000;
 iterations.push(last);history.push({round:round+1,elements:m.tetrahedra.length,maxDisplacementMm:u,maxVonMisesPa:last.result.maxVonMisesPa,peakSizeMm,relativeDisplacementChange:change,stressVariationIndicator:variation,solverResidual:last.result.residual,elapsedSeconds:(now()-started)/1000});diagnostic=diagnoseConvergence(history,{tolerance,stressTolerance});
 if(diagnostic.suspectedSingularity){stopReason='suspected stress singularity; peak stress is unresolved';break;}
 if(diagnostic.status==='stable'&&variation<.2){converged=true;stopReason='displacement, peak stress and stress variation thresholds met';break;}
 if(now()-started>=maxSeconds*1000){stopReason='time limit reached';break;}
 previous=u;indicators.sort((a,b)=>b.score-a.score);const count=Math.max(1,Math.min(80,Math.ceil(indicators.length*.15)));for(const r of indicators.slice(0,count))refinements.push({center:r.center,radius:baseSize*1.5,size:Math.max(baseSize*.15,baseSize/2**(round+1))});
 }
 return {...last,adaptive:{converged,diagnostic,history,iterations,stopReason,maxElements,maxSeconds,elapsedSeconds:(now()-started)/1000,indicator:'recovered stress variation, strain and displacement; trend diagnostics are not certified error bounds or proof of singularity'}};
}
