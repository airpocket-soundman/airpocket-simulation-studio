import {sphericalOuterFaces} from './acoustic-radiation.js';
const quadrature=[
 [.225,[1/3,1/3,1/3]],
 ...[0,1,2].map(i=>[.132394152788506,Array.from({length:3},(_,j)=>i===j?.05971587178977:.470142064105115)]),
 ...[0,1,2].map(i=>[.125939180544827,Array.from({length:3},(_,j)=>i===j?.797426985353087:.101286507323456)])
];
export function validateFarFieldStudy(s){
 for(const key of ['exteriorRadiation','directivityEnabled'])if(s[key]!==undefined&&typeof s[key]!=='boolean')throw Error('Invalid exterior acoustic setting');
 if(s.directivityEnabled){if(s.kind!=='acoustic'||!s.exteriorRadiation)throw Error('Far-field directivity requires exterior acoustic radiation');if(!Number.isInteger(s.directivityPoints)||s.directivityPoints<12||s.directivityPoints>180||!Number.isInteger(s.directivityAxis)||s.directivityAxis<0||s.directivityAxis>2||!Number.isFinite(s.directivityDistanceMm)||s.directivityDistanceMm<=0)throw Error('Invalid directivity plane, count or reference distance');}
}
export function acousticFarField(mesh,result,{axis=2,count=36,referenceDistanceM=1}={}){
 if(result.kind!=='acoustic'||result.radiation?.model!=='spherical-first-order')throw Error('Far-field integral requires a spherical exterior radiation solution');
 if(!Number.isInteger(axis)||axis<0||axis>2||!Number.isInteger(count)||count<12||count>180||!Number.isFinite(referenceDistanceM)||referenceDistanceM<=0)throw Error('Invalid far-field sampling settings');
 const meta=result.radiation,faces=sphericalOuterFaces(mesh,meta),k=meta.waveNumberReal,decay=meta.waveNumberDecay,radiusM=meta.radiusMm*.001;
 if(![k,decay].every(Number.isFinite)||k<=0||decay<0||decay*radiusM>25)throw Error('Far-field attenuation exceeds the supported integral range');
 const plane=[(axis+1)%3,(axis+2)%3],samples=[];
 for(let angle=0;angle<count;angle++){const theta=angle/count*2*Math.PI,direction=[0,0,0];direction[plane[0]]=Math.cos(theta);direction[plane[1]]=Math.sin(theta);let real=0,imag=0;
  for(const face of faces){const cos=direction.reduce((s,v,i)=>s+v*face.normal[i],0),a=decay*(1+cos)+1/radiusM,b=k*(1+cos);
   for(const [weight,N]of quadrature){const pReal=face.nodes.reduce((s,node,i)=>s+N[i]*result.real[node],0),pImag=face.nodes.reduce((s,node,i)=>s+N[i]*result.imag[node],0),projection=face.relativeM.reduce((s,p,i)=>s+N[i]*p.reduce((t,v,j)=>t+v*direction[j],0),0),phase=k*projection,amplitude=Math.exp(decay*projection),er=amplitude*Math.cos(phase),ei=amplitude*Math.sin(phase),tr=a*pReal-b*pImag,ti=a*pImag+b*pReal,factor=face.areaM2*weight/(4*Math.PI);real+=factor*(tr*er-ti*ei);imag+=factor*(tr*ei+ti*er);}
  }
  const amplitude=Math.exp(-decay*referenceDistanceM)/referenceDistanceM,phase=-k*referenceDistanceM,er=amplitude*Math.cos(phase),ei=amplitude*Math.sin(phase),pressureReal=real*er-imag*ei,pressureImag=real*ei+imag*er,peakPressurePa=Math.hypot(pressureReal,pressureImag),splDb=20*Math.log10(Math.max(peakPressurePa/Math.SQRT2,1e-12)/result.referencePressurePa);
  if(![pressureReal,pressureImag,peakPressurePa,splDb].every(Number.isFinite))throw Error('Nonfinite far-field pressure');samples.push({angleDeg:angle/count*360,direction,pressureReal,pressureImag,peakPressurePa,splDb});
 }
 const maxPeakPressurePa=Math.max(...samples.map(s=>s.peakPressurePa)),normalized=maxPeakPressurePa>Math.SQRT2*1e-12;for(const s of samples)s.relativeDb=normalized?20*Math.log10(Math.max(s.peakPressurePa/maxPeakPressurePa,1e-12)):null;
 return {method:'Kirchhoff-Helmholtz spherical trace',axis,referenceDistanceM,count,maxPeakPressurePa,normalized,samples,convention:'Far-field asymptotic pressure scaled to reference distance; not an in-domain probe'};
}
