import {cylindricalFrame} from './cylindrical-region.js';
// REG2 step 2 kernel: geometry of a conical patch (surface of revolution of a straight profile). Not yet wired into selection, fragmentation or boundaries.
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
export function validateConicalPatch(d){
 if(!d||!['radiusAtMin','radiusAtMax'].every(k=>Number.isFinite(d[k])&&d[k]>0))throw Error('Invalid conical region radii');
 const frame=cylindricalFrame({...d,radius:d.radiusAtMin,tolerance:0});return {...frame,slope:(d.radiusAtMax-d.radiusAtMin)/(d.axialMax-d.axialMin)};
}
export const conicalRadius=(d,z)=>{const {slope}=validateConicalPatch(d);return d.radiusAtMin+slope*(z-d.axialMin);};
export function conicalPatchArea(d){validateConicalPatch(d);const h=d.axialMax-d.axialMin,slant=Math.hypot(h,d.radiusAtMax-d.radiusAtMin);return d.sweepDegrees*Math.PI/180*(d.radiusAtMin+d.radiusAtMax)/2*slant;}
export function conicalPatchPoint(d,z,degrees){const {axis,reference,tangent}=validateConicalPatch(d),a=degrees*Math.PI/180,r=conicalRadius(d,z);return d.origin.map((v,k)=>v+z*axis[k]+r*(reference[k]*Math.cos(a)+tangent[k]*Math.sin(a)));}
export function conicalPatchContains(d,point,{tolerance=1e-6}={}){const {axis,reference,tangent}=validateConicalPatch(d),p=point.map((v,k)=>v-d.origin[k]),z=dot(p,axis),radial=p.map((v,k)=>v-z*axis[k]);if(z<d.axialMin-tolerance||z>d.axialMax+tolerance||Math.abs(Math.hypot(...radial)-conicalRadius(d,z))>tolerance)return false;const a=Math.atan2(dot(radial,tangent),dot(radial,reference))*180/Math.PI,relative=((a-d.startDegrees)%360+360)%360,angleTolerance=tolerance/conicalRadius(d,z)*180/Math.PI;return d.sweepDegrees===360||relative<=d.sweepDegrees+angleTolerance||relative>=360-angleTolerance;}
// Same construction as makeCylinderPatch: revolve the straight profile line; OCCT yields one Cone (or Cylinder when radii are equal) face.
export function makeConicalPatch(g,d){
 const {axis}=validateConicalPatch(d);if(d.sweepDegrees<.1||d.axialMax-d.axialMin<1e-6)throw Error('Exact conical patch is too small');const points=[d.axialMin,d.axialMax].map(z=>g.model.occ.addPoint(...conicalPatchPoint(d,z,d.startDegrees))),line=g.model.occ.addLine(...points),out=g.model.occ.revolve([1,line],...d.origin,...axis,d.sweepDegrees*Math.PI/180,[],[],false),surfaces=[];for(let i=0;i<out.outDimTags.length;i+=2)if(out.outDimTags[i]===2)surfaces.push(out.outDimTags[i+1]);if(surfaces.length!==1)throw Error('Unable to construct conical CAD patch');return surfaces[0];
}
