import {validateSphere} from './fluid-domain.js';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function acousticWaveNumber({frequency,soundSpeed,lossFactor=0}){
 if(![frequency,soundSpeed,lossFactor].every(Number.isFinite)||frequency<=0||soundSpeed<=0||lossFactor<0)throw Error('Invalid radiation wave parameters');
 const k=2*Math.PI*frequency/soundSpeed,q=Math.hypot(1,lossFactor),real=k*Math.sqrt((q+1)/2),decay=k*lossFactor/Math.sqrt(2*(q+1));
 if(![real,decay].every(Number.isFinite))throw Error('Radiation wave number exceeds numerical limits');return {real,decay};
}
export function sphericalOuterFaces(mesh,{centerMm,radiusMm}){
 validateSphere({kind:'sphere',center:centerMm,radius:radiusMm});
 const tolerance=Math.max(1e-5,radiusMm*1e-7),edges=new Map(),vertices=new Set(),faces=[];let solidAngle=0;
 for(const [index,f]of mesh.surface.entries()){
  if(f.nodes.length!==3||new Set(f.nodes).size!==3||!f.nodes.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.nodes.length/3))throw Error('Invalid acoustic boundary triangle');
  const relative=f.nodes.map(i=>mesh.nodes.slice(i*3,i*3+3).map((v,k)=>v-centerMm[k]));if(relative.some(p=>Math.abs(Math.hypot(...p)-radiusMm)>tolerance))continue;
  const u=relative[1].map((v,k)=>v-relative[0][k]),v=relative[2].map((v,k)=>v-relative[0][k]),c=cross(u,v),norm=Math.hypot(...c);if(!(norm>0)||!Number.isFinite(norm))throw Error('Degenerate acoustic radiation triangle');
  const center=relative[0].map((_,k)=>relative.reduce((s,p)=>s+p[k]/3,0)),normal=c.map(v=>v/norm*(dot(c,center)<0?-1:1)),unit=relative.map(p=>p.map(v=>v/Math.hypot(...p)));
  solidAngle+=2*Math.atan2(Math.abs(dot(unit[0],cross(unit[1],unit[2]))),1+dot(unit[0],unit[1])+dot(unit[1],unit[2])+dot(unit[2],unit[0]));
  for(const i of f.nodes)vertices.add(i);for(let a=0;a<3;a++){const i=f.nodes[a],j=f.nodes[(a+1)%3],key=i<j?i+','+j:j+','+i;edges.set(key,(edges.get(key)||0)+1);}
  faces.push({...f,index,relativeM:relative.map(p=>p.map(v=>v*.001)),normal,areaM2:norm*.5e-6});
 }
 if(!faces.length||[...edges.values()].some(n=>n!==2)||vertices.size-edges.size+faces.length!==2||Math.abs(solidAngle-4*Math.PI)>1e-5)throw Error('Radiation requires a complete closed spherical outer boundary enclosing its center');
 return faces;
}
export function sphericalRadiation(mesh,boundary,sphere,study){
 const faces=sphericalOuterFaces(mesh,sphere),wave=acousticWaveNumber(study),rho=study.airDensity;
 if(!(rho>0)||!Number.isFinite(rho))throw Error('Positive acoustic density required');
 const omega=2*Math.PI*study.frequency,a=(wave.decay+1000/sphere.radiusMm)/rho,b=wave.real/rho,den=a*a+b*b,value=omega*b/den,reactance=omega*a/den;
 if(!(value>0)||![value,reactance].every(Number.isFinite))throw Error('Radiation impedance exceeds numerical limits');
 const keys=new Set(faces.map(f=>[...f.nodes].sort((a,b)=>a-b).join(','))),outerNodes=new Set(faces.flatMap(f=>f.nodes));
 if((boundary.acousticPressures||[]).some(([i])=>outerNodes.has(i))||(boundary.impedance||[]).some(f=>keys.has([...f.nodes].sort((a,b)=>a-b).join(','))))throw Error('Spherical radiation cannot overlap prescribed pressure or other impedance');
 return {impedance:faces.map(f=>({nodes:[...f.nodes],areaM2:f.areaM2,value,reactance,radiation:true})),metadata:{model:'spherical-first-order',centerMm:[...sphere.centerMm],radiusMm:sphere.radiusMm,faceCount:faces.length,waveNumberReal:wave.real,waveNumberDecay:wave.decay,airDensity:rho}};
}
