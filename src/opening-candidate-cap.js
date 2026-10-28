import {extractOpeningLoopCandidates} from './opening-loop-candidates.js';
import {validateOpeningCaps} from './fluid-opening-caps.js';

const vector=v=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x));
const same=(a,b)=>{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
};
/** Pure, explicit confirmation boundary. Recompute from the current indexed mesh;
 * caller owns monotonic meshVersion identity. Never infer physical outward from
 * the detector's canonical winding. No CAD construction or UI side effects. */
export function confirmOpeningCandidate(input){
 const {mesh,meshVersion,confirmation,enclosure}=input??{};
 if(!Number.isSafeInteger(meshVersion)||meshVersion<0||confirmation?.meshVersion!==meshVersion)throw Error('Stale or invalid opening mesh version');
 if(confirmation.confirmed!==true)throw Error('Opening candidate requires explicit confirmation');
 const result=extractOpeningLoopCandidates(mesh);
 const candidate=result.candidates.find(c=>c.id===confirmation.candidate?.id);
 if(!candidate||!same(candidate,confirmation.candidate))throw Error('Opening candidate is unavailable, unhealthy or modified');
 const normal=confirmation.outwardNormal,seedPoint=confirmation.interiorPointMm;
 if(!vector(normal)||Math.abs(Math.hypot(...normal)-1)>1e-8||!vector(seedPoint))throw Error('Opening confirmation requires explicit finite unit outward normal and interior point');
 // Orientation may have either sign; direction is resolved solely by the user's
 // normal and strictly retained interior point through the existing cap validator.
 const alignment=normal.reduce((s,v,k)=>s+v*candidate.plane.normal[k],0);
 if(Math.abs(Math.abs(alignment)-1)>1e-8)throw Error('Opening normal is inconsistent with candidate plane');
 const cap={id:confirmation.capId,point:[...candidate.plane.pointMm],normal:[...normal]};
 const source={mode:'internal',enclosure:Array.isArray(enclosure)?[...enclosure]:enclosure,seedPoint:[...seedPoint],openingCaps:[cap]};
 if(!Array.isArray(enclosure)||enclosure.length!==6||!enclosure.every(x=>typeof x==='number'&&Number.isFinite(x))||!enclosure.slice(3).every(x=>x>0)||seedPoint.some((v,k)=>v<enclosure[k]||v>enclosure[k]+enclosure[k+3]))throw Error('Opening confirmation requires a finite enclosure and interior point inside it');
 validateOpeningCaps(source);
 return {status:'confirmed',meshVersion,candidateId:candidate.id,nodeIndices:[...candidate.nodeIndices],toleranceMm:result.toleranceMm,source};
}
