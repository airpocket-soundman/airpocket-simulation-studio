import {validateSourceAssessment} from './source-assessment.js';
import {sampleResult} from './probe.js';
import {inspectMesh} from './mesh-core.js';
import {outwardSurfaceNormals} from './surface-loads.js';

export function validateVibrationSource(s){
 if(s?.sourceAssessment!==undefined)validateSourceAssessment(s.sourceAssessment);
 const m=s?.mesh,b=s?.bounds;
 if(!m||!Array.isArray(m.nodes)||m.nodes.length<12||m.nodes.length%3||m.nodes.length>6000||!m.nodes.every(Number.isFinite)||!Array.isArray(m.tetrahedra)||!m.tetrahedra.length||m.tetrahedra.length>8000||m.tetrahedra.some(t=>!Array.isArray(t)||t.length!==4||new Set(t).size!==4||!t.every(i=>Number.isInteger(i)&&i>=0&&i<m.nodes.length/3))||!Array.isArray(s.displacement)||s.displacement.length!==m.nodes.length||!s.displacement.every(Number.isFinite)||!Array.isArray(b)||b.length!==6||!b.every(Number.isFinite)||[3,4,5].some(i=>b[i]<=0)||!Number.isFinite(s.frequencyHz)||s.frequencyHz<=0||!Number.isFinite(s.amplitudeMm)||s.amplitudeMm<0||s.amplitudeMm>Math.min(...b.slice(3))*.01||!Number.isFinite(s.phaseDeg)||Math.abs(s.phaseDeg)>360||!Number.isInteger(s.modeIndex)||s.modeIndex<0||s.modeIndex>5||typeof s.name!=='string'||s.name.length>100)throw Error('Invalid modal acoustic source');
 if(m.nodes.some((v,i)=>v<b[i%3]-1e-5||v>b[i%3]+b[i%3+3]+1e-5)||Math.abs(Math.max(...Array.from({length:m.nodes.length/3},(_,i)=>Math.hypot(...s.displacement.slice(3*i,3*i+3))))-1)>1e-8)throw Error('Modal acoustic source requires a box and a 1 mm normalized mode');
 return s;
}

export function validateVibrationStudy(study){
 if(study.vibrationSource===undefined)return;
 validateVibrationSource(study.vibrationSource);
 if(study.kind!=='acoustic'||study.acousticTransient||study.sweep||!study.exteriorRadiation||Math.abs(study.frequency-study.vibrationSource.frequencyHz)>1e-8||!Number.isFinite(study.frequency))throw Error('Modal sound coupling requires exterior frequency acoustics at the saved mode frequency');
 if(2*Math.PI*study.frequency*study.vibrationSource.amplitudeMm*.001/(study.soundSpeed??343)>.1)throw Error('Prescribed modal velocity exceeds the small-amplitude acoustic limit');
}

/** One-way, prescribed modal displacement -> complex fluid-outward normal velocity.
 * Box interfaces are planar, so independently meshed trace nodes lie on the solid.
 * No nearest-surface fallback: missing coverage is rejected.
 */
export function modalNormalVelocity(source,airMesh,solid){
 validateVibrationSource(source);const b=source.bounds;
 if(solid?.kind!=='box'||!Array.isArray(solid.bounds)||solid.bounds.length!==6||solid.bounds.some((v,i)=>Math.abs(v-b[i])>1e-7))throw Error('Modal sound prototype requires the unchanged box solid');
 const summary=inspectMesh(source.mesh),exactVolume=b[3]*b[4]*b[5];if(Math.abs(summary.volumeMm3/exactVolume-1)>1e-6)throw Error('Modal source mesh does not cover the whole box');
 const normals=outwardSurfaceNormals(airMesh),sampled=new Map(),omega=2*Math.PI*source.frequencyHz,angle=source.phaseDeg*Math.PI/180,real=Math.cos(angle),imag=Math.sin(angle),trace=[],areas=Array(6).fill(0);
 for(const [index,f]of airMesh.surface.entries()){
  const points=f.nodes.map(i=>airMesh.nodes.slice(3*i,3*i+3)),plane=[0,1,2,3,4,5].find(p=>{const axis=p%3,value=b[axis]+(p>=3?b[axis+3]:0);return points.every(x=>Math.abs(x[axis]-value)<1e-5&&x.every((v,k)=>v>=b[k]-1e-5&&v<=b[k]+b[k+3]+1e-5));});if(plane===undefined)continue;
  const a=points[1].map((v,k)=>v-points[0][k]),c=points[2].map((v,k)=>v-points[0][k]),areaM2=Math.hypot(a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0])*.5e-6;
  const expected=Array(3).fill(0);expected[plane%3]=plane<3?1:-1;if(normals[index].reduce((s,v,k)=>s+v*expected[k],0)<1-1e-7)throw Error('Modal acoustic interface normal does not point into the solid');
  const velocity=f.nodes.map((node,j)=>{if(!sampled.has(node))sampled.set(node,sampleResult(source.mesh,{kind:'modal',modes:[{displacement:source.displacement,frequencyHz:source.frequencyHz}]},points[j]).displacementMm);const displacement=sampled.get(node).reduce((s,v,k)=>s+v*normals[index][k],0)*source.amplitudeMm*.001;return omega*displacement;});
  trace.push({nodes:[...f.nodes],areaM2,real:velocity.map(v=>-v*imag),imag:velocity.map(v=>v*real)});areas[plane]+=areaM2;
 }
 const expected=[b[4]*b[5],b[3]*b[5],b[3]*b[4]].map(v=>v*1e-6);if(areas.some((v,i)=>Math.abs(v/expected[i%3]-1)>1e-6))throw Error('Modal acoustic box interface is incomplete');
 return {normalVelocity:trace,metadata:{model:'one-way modal surface velocity',sourceName:source.name,modeIndex:source.modeIndex,frequencyHz:source.frequencyHz,amplitudeMm:source.amplitudeMm,phaseDeg:source.phaseDeg,faceCount:trace.length,areaM2:areas.reduce((s,v)=>s+v,0),maxNormalVelocityMs:trace.reduce((max,f)=>Math.max(max,...f.real.map((v,i)=>Math.hypot(v,f.imag[i]))),0),transfer:'Tet4 nodal interpolation / planar box interfaces'}};
}
