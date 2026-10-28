// Two-parameter Weibull weakest-link volume failure probability using the
// principle of independent action (PIA) over tensile principal stresses.
// Parameters must come from registered strength tests; no defaults exist.
import {tetraVolume} from './tetra-geometry.js';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const record=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const text=v=>typeof v==='string'&&!!v.trim()&&v.length<=10000;
const positive=v=>Number.isFinite(v)&&v>0;
const KEYS=['model','weibullModulus','characteristicStrengthPa','referenceVolumeMm3','source','testConditions','surfaceCondition'];
export function validateWeibullData(d){
 if(!record(d,KEYS)||d.model!=='weibull-2p-volume-pia'||!positive(d.weibullModulus)||d.weibullModulus>200||!positive(d.characteristicStrengthPa)||!positive(d.referenceVolumeMm3)||!['source','testConditions','surfaceCondition'].every(k=>text(d[k])))throw Error('Weibull data requires a positive modulus, characteristic strength, reference volume, source, test conditions and surface state');
}
// Eigenvalues of the symmetric stress [xx,yy,zz,xy,yz,xz] (same order as fracture-core).
export function principalStresses(s){
 const scale=Math.max(...s.map(Math.abs));if(!scale)return [0,0,0];
 const [a,b,c,d,e,f]=s.map(x=>x/scale),q=(a+b+c)/3,p1=d*d+e*e+f*f;
 let l;
 if(p1===0)l=[a,b,c];
 else{
  const p2=(a-q)**2+(b-q)**2+(c-q)**2+2*p1,p=Math.sqrt(p2/6),A=(a-q)/p,B=(b-q)/p,C=(c-q)/p,D=d/p,E=e/p,F=f/p;
  const det=A*(B*C-E*E)-D*(D*C-E*F)+F*(D*E-B*F),phi=Math.acos(Math.min(1,Math.max(-1,det/2)))/3;
  const l1=q+2*p*Math.cos(phi),l3=q+2*p*Math.cos(phi+2*Math.PI/3);l=[l1,3*q-l1-l3,l3];
 }
 return l.map(x=>x*scale).sort((x,y)=>y-x);
}
export function evaluateWeibullFailure(r,elementVolumesMm3,data){
 validateWeibullData(data);
 if(r?.kind!=='elastic'||r.plasticity||r.hyperelastic||r.thermalStress)throw Error('Weibull assessment requires a linear elastic result');
 if(!Array.isArray(r.stresses)||!r.stresses.length||r.stresses.length>30000||r.stresses.some(s=>!Array.isArray(s)||s.length!==6||!s.every(Number.isFinite)))throw Error('Weibull assessment requires finite six-component element stresses in Pa');
 if(!Array.isArray(elementVolumesMm3)||elementVolumesMm3.length!==r.stresses.length||!elementVolumesMm3.every(positive))throw Error('Weibull assessment requires one positive volume per element in mm^3');
 const m=data.weibullModulus,s0=data.characteristicStrengthPa,v0=data.referenceVolumeMm3,elementRisk=[],maxPrincipalPa=[];
 for(let i=0;i<r.stresses.length;i++){
  const p=principalStresses(r.stresses[i]);maxPrincipalPa.push(p[0]);
  elementRisk.push(elementVolumesMm3[i]/v0*p.reduce((sum,x)=>sum+(x>0?(x/s0)**m:0),0));
 }
 const risk=elementRisk.reduce((a,b)=>a+b,0);if(!Number.isFinite(risk))throw Error('Weibull assessment exceeded the numerical range');
 const peak=Math.max(...maxPrincipalPa),effectiveVolumeMm3=peak>0?risk*v0*(s0/peak)**m:0;
 return {kind:'weibull-failure',model:data.model,weibullData:structuredClone(data),elementRisk,maxPrincipalPa,riskOfRupture:risk,failureProbability:-Math.expm1(-risk),peakPrincipalPa:peak,effectiveVolumeMm3};
}
// Couples a solved Tet4 mesh (nodes in mm) to the weakest-link sum: each element's
// constant stress acts over its own volume, so the sum is the exact volume integral of the FE stress field.
export function tetraVolumesMm3(mesh){
 if(!Array.isArray(mesh?.nodes)&&!ArrayBuffer.isView(mesh?.nodes)||mesh.nodes.length%3||!Array.isArray(mesh.tetrahedra)||!mesh.tetrahedra.length)throw Error('Weibull mesh coupling requires Tet4 nodes and tetrahedra');
 const count=mesh.nodes.length/3;
 return mesh.tetrahedra.map(t=>{if(!Array.isArray(t)||t.length!==4||!t.every(i=>Number.isInteger(i)&&i>=0&&i<count))throw Error('Weibull mesh coupling requires four valid node indices per tetrahedron');const v=Math.abs(tetraVolume(mesh.nodes,t));if(!positive(v))throw Error('Weibull mesh coupling requires non-degenerate tetrahedra');return v;});
}
export function evaluateWeibullFailureOnMesh(mesh,r,data){
 const volumes=tetraVolumesMm3(mesh);if(r?.stresses?.length!==volumes.length)throw Error('Weibull mesh coupling requires one stress per tetrahedron of the solved mesh');
 return {...evaluateWeibullFailure(r,volumes,data),totalVolumeMm3:volumes.reduce((a,b)=>a+b,0)};
}
