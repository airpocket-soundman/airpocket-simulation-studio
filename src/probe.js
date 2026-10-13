import {invert} from './fem-core.js';
export function sampleResult(mesh,result,point){
 if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))throw Error('Invalid probe point');
 for(let e=0;e<mesh.tetrahedra.length;e++){const t=mesh.tetrahedra[e],p=t.map(i=>mesh.nodes.slice(i*3,i*3+3));if([0,1,2].some(k=>point[k]<Math.min(...p.map(v=>v[k]))-1e-7||point[k]>Math.max(...p.map(v=>v[k]))+1e-7))continue;const inv=invert(p.map(v=>[1,...v])),w=t.map((_,i)=>inv[0][i]+point.reduce((s,v,k)=>s+inv[k+1][i]*v,0));if(w.some(v=>v< -1e-7||v>1+1e-7))continue;const scalar=values=>t.reduce((s,i,a)=>s+w[a]*values[i],0),out={point,element:e,weights:w};
 if(result.kind==='elastic'){out.displacementMm=[0,1,2].map(k=>t.reduce((s,i,a)=>s+w[a]*result.displacement[i*3+k],0));out.magnitudeMm=Math.hypot(...out.displacementMm);out.vonMisesPa=result.vonMises[e];}
 else if(result.kind==='thermal'){out.temperature=scalar(result.temperature);out.flux=result.flux[e];}
 else if(result.kind==='acoustic'){out.pressureReal=scalar(result.real);out.pressureImag=scalar(result.imag);out.peakPressurePa=Math.hypot(out.pressureReal,out.pressureImag);out.rmsPressurePa=out.peakPressurePa/Math.SQRT2;out.splDb=20*Math.log10(Math.max(out.rmsPressurePa,1e-12)/result.referencePressurePa);out.phase=Math.atan2(out.pressureImag,out.pressureReal);}
 return out;
 }
 throw Error('Probe point is outside the analysis mesh');
}
