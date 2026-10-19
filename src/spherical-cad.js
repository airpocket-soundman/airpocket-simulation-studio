import {sphericalFrame,sphericalPoint,sphericalContains} from './spherical-region.js';
import {canonicalJson} from './project-revision.js';
export function sphericalPatchArea(d){sphericalFrame(d);const area=d.radius*d.radius*(d.sweepDegrees*Math.PI/180)*(Math.sin(d.latitudeMax*Math.PI/180)-Math.sin(d.latitudeMin*Math.PI/180));if(!Number.isFinite(area)||area<=0)throw Error('Invalid spherical patch area');return area;}
export function makeSphericalPatch(g,d){
 const {axis}=sphericalFrame(d),angles=[d.latitudeMin,(d.latitudeMin+d.latitudeMax)/2,d.latitudeMax],points=angles.map(lat=>g.model.occ.addPoint(...sphericalPoint(d,lat,d.startDegrees)));
 const arc=g.model.occ.addCircleArc(points[0],points[1],points[2],-1,false);
 // The through-point defines the circle geometry but is not an arc endpoint.
 // Leaving it in the CAD model creates an orphan mesh node in getNodes().
 g.model.occ.remove([0,points[1]],false);
 const out=g.model.occ.revolve([1,arc],...d.center,...axis,d.sweepDegrees*Math.PI/180,[],[],false),surfaces=[];
 for(let i=0;i<out.outDimTags.length;i+=2)if(out.outDimTags[i]===2)surfaces.push(out.outDimTags[i+1]);
 if(surfaces.length!==1)throw Error('Unable to construct spherical CAD patch');return surfaces[0];
}
export function validateSphericalMesh(mesh,project){
 const expected=(project?.conditions||[]).flatMap((c,i)=>c.sphericalRegion?[[i,c.sphericalRegion]]:[]);
 if(!expected.length){if(mesh?.sphericalPatches?.length)throw Error('Unexpected saved spherical patches');return;}
 if(!Array.isArray(mesh.sphericalPatches)||mesh.sphericalPatches.length!==expected.length)throw Error('Missing saved spherical patches');
 for(const [index,d]of expected){
  const matches=mesh.sphericalPatches.filter(p=>p.conditionIndex===index),p=matches[0];if(matches.length!==1||canonicalJson(p.region)!==canonicalJson(d)||!Number.isFinite(p.areaMm2)||Math.abs(p.areaMm2/sphericalPatchArea(d)-1)>1e-7)throw Error('Invalid saved spherical CAD patch');
  // Verify the reverse declaration as well: removing a patch label and editing
  // its cached faceted area must not hide a triangle geometrically in the patch.
  for(const f of mesh.surface){const points=f.nodes.map(i=>mesh.nodes.slice(3*i,3*i+3)),center=[0,1,2].map(k=>points.reduce((sum,v)=>sum+v[k],0)/3-d.center[k]),length=Math.hypot(...center),projected=center.map((v,k)=>d.center[k]+d.radius*v/length),inside=points.every(v=>sphericalContains(d,v))&&sphericalContains(d,projected);if(inside!==Boolean(f.patchConditions?.includes(index)))throw Error('Saved spherical patch triangle declaration mismatch');}
  let area=0;for(const f of mesh.surface){if(!f.patchConditions?.includes(index))continue;const points=f.nodes.map(i=>mesh.nodes.slice(3*i,3*i+3));if(points.some(v=>!sphericalContains(d,v)))throw Error('Saved spherical patch extends outside its dimensions');const a=points[1].map((v,k)=>v-points[0][k]),b=points[2].map((v,k)=>v-points[0][k]);area+=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])*.5;}
  // Keep the existing exact curved-patch faceting budget (3%), not a new one.
  if(!Number.isFinite(p.meshAreaMm2)||p.meshAreaMm2<=0||Math.abs(area/p.meshAreaMm2-1)>1e-7||Math.abs(area/sphericalPatchArea(d)-1)>.03)throw Error('Saved spherical patch mesh area mismatch');
 }
}
