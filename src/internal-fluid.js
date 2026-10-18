import {capForCadFace,openingCapDistance,validateOpeningCaps,validateCappedBoundary} from './fluid-opening-caps.js';
import {validateTube} from './fluid-domain.js';

export function addTube(g,s){
 validateTube(s);const base=[...s.center],direction=[0,0,0];base[s.axis]-=s.length/2;direction[s.axis]=s.length;const outer=g.model.occ.addCylinder(...base,...direction,s.outerRadius),inner=g.model.occ.addCylinder(...base,...direction,s.innerRadius);const cut=g.model.occ.cut([3,outer],[3,inner],-1,true,true);if(cut.outDimTags?.length!==2)throw Error('Hollow tube must form one solid volume');
}

export function assertFluidSeed(g,tools,source){
 if(source.mode!=='internal')return;for(let i=0;i<tools.length;i+=2)if(g.model.isInside(3,tools[i+1],source.seedPoint))throw Error('Internal fluid seed is inside the solid or on its boundary');
}

/** Keep the unique CAD-subtracted component containing the seed, with explicit caps.
 * Port planes: 0/1/2 = X/Y/Z min, 3/4/5 = X/Y/Z max. No guessed hole closure.
 */
export function selectInternalFluid(g,cut,source){
 const selected=[];for(let i=0;i<cut.length;i+=2)if(g.model.isInside(3,cut[i+1],source.seedPoint))selected.push(cut[i+1]);if(selected.length!==1)throw Error('Seed does not identify exactly one CAD fluid volume');
 const tag=selected[0],b=source.enclosure,remove=[];
 for(let i=0;i<cut.length;i+=2)if(cut[i+1]!==tag)remove.push(3,cut[i+1]);
 if(remove.length){g.model.occ.remove(remove,true);g.model.occ.synchronize();}
 const faces=g.model.getBoundary([3,tag],false,false,false).outDimTags,ports=[],walls=[],present=new Set(),presentCaps=new Set(),tol=1e-6;
 for(let i=0;i<faces.length;i+=2){const faceTag=faces[i+1],cap=capForCadFace(g,faceTag,source.openingCaps);if(cap){ports.push({capId:cap.id,faceTag});presentCaps.add(cap.id);continue;}const bounds=g.model.getBoundingBox(2,faceTag),plane=[0,1,2,3,4,5].find(p=>{const axis=p%3,value=b[axis]+(p>=3?b[axis+3]:0);return ['xmin','ymin','zmin'][axis] in bounds&&Math.abs(bounds[['xmin','ymin','zmin'][axis]]-value)<tol&&Math.abs(bounds[['xmax','ymax','zmax'][axis]]-value)<tol;});if(plane===undefined)walls.push(faceTag);else{if(!source.portPlanes.includes(plane))throw Error('Selected fluid leaks to a box face not declared as a port; adjust the cap planes');ports.push({plane,faceTag});present.add(plane);}}
 if((source.openingCaps??[]).some(cap=>!presentCaps.has(cap.id)))throw Error('A declared opening cap does not intersect the seed-selected fluid volume');
 if(source.portPlanes.some(p=>!present.has(p)))throw Error('A declared port does not intersect the selected fluid volume');
 const cadVolumeMm3=g.model.occ.getMass(3,tag).mass;if(!(cadVolumeMm3>0)||!Number.isFinite(cadVolumeMm3))throw Error('Invalid CAD fluid volume');
 let channel;
 if(!source.openingCaps&&present.size===2&&source.portPlanes[0]%3===source.portPlanes[1]%3&&Math.abs(source.portPlanes[0]-source.portPlanes[1])===3&&walls.length&&walls.every(t=>g.model.getType(2,t).entityType==='Cylinder')){
  const axis=source.portPlanes[0]%3,start=b[axis],end=start+b[axis+3],lengthMm=end-start,com=g.model.occ.getCenterOfMass(3,tag),centerMm=[com.x,com.y,com.z],radiusMm=Math.sqrt(cadVolumeMm3/(Math.PI*lengthMm)),areaM2=cadVolumeMm3/lengthMm*1e-6;
  const wallArea=walls.reduce((s,t)=>s+g.model.occ.getMass(2,t).mass,0),endAreas=ports.reduce((s,p)=>s+g.model.occ.getMass(2,p.faceTag).mass,0);
  if(Math.abs(wallArea/(2*Math.PI*radiusMm*lengthMm)-1)<1e-6&&Math.abs(endAreas/(2*Math.PI*radiusMm**2)-1)<1e-6)channel={model:'CAD circular cylinder',axis,start,end,lengthM:lengthMm*.001,radiusMm,centerMm,hydraulicDiameterM:2*radiusMm*.001,areaM2};
 }
 if(!source.openingCaps&&!channel&&present.size===2&&source.portPlanes[0]%3===source.portPlanes[1]%3&&Math.abs(source.portPlanes[0]-source.portPlanes[1])===3&&walls.length&&walls.every(t=>g.model.getType(2,t).entityType==='Plane')){
  const axis=source.portPlanes[0]%3,cross=[0,1,2].filter(k=>k!==axis),limits=cross.map(()=>[]);let aligned=true;
  for(const tag of walls){const bb=g.model.getBoundingBox(2,tag),k=cross.findIndex(axis=>Math.abs(bb[['xmax','ymax','zmax'][axis]]-bb[['xmin','ymin','zmin'][axis]])<1e-6);if(k<0){aligned=false;break;}limits[k].push((bb[['xmin','ymin','zmin'][cross[k]]]+bb[['xmax','ymax','zmax'][cross[k]]])/2);}
  const lo=limits.map(v=>Math.min(...v)),hi=limits.map(v=>Math.max(...v)),widthMm=lo.map((v,k)=>hi[k]-v),start=b[axis],end=start+b[axis+3],lengthMm=end-start,expectedVolume=widthMm[0]*widthMm[1]*lengthMm;
  if(aligned&&widthMm.every(v=>Number.isFinite(v)&&v>0)&&Math.abs(cadVolumeMm3/expectedVolume-1)<1e-6&&limits.every((v,k)=>v.every(x=>Math.abs(x-lo[k])<1e-6||Math.abs(x-hi[k])<1e-6))){const com=g.model.occ.getCenterOfMass(3,tag);channel={model:'CAD rectangular prism',axis,start,end,lengthM:lengthMm*.001,widthMm,centerMm:[com.x,com.y,com.z],hydraulicDiameterM:2*widthMm[0]*widthMm[1]/(widthMm[0]+widthMm[1])*.001,areaM2:widthMm[0]*widthMm[1]*1e-6};}
 }
 return {mode:'internal',seedPoint:[...source.seedPoint],cadVolumeMm3,excludedVolumes:remove.length/2,ports,...(channel?{channel}:{})};
}

export function validateInternalMesh(mesh,source){
 const d=mesh?.domainSelection,internal=source?.kind==='fluidDomain'&&source.mode==='internal';
 if(Boolean(d)!==internal)throw Error('Saved internal fluid mesh does not match its source');if(!d)return;
 validateOpeningCaps(source);const b=source.enclosure;
 if(d.mode!=='internal'||!Number.isFinite(d.cadVolumeMm3)||d.cadVolumeMm3<=0||!Number.isInteger(d.excludedVolumes)||d.excludedVolumes<0||d.excludedVolumes>10000||!Array.isArray(d.seedPoint)||d.seedPoint.length!==3||d.seedPoint.some((v,i)=>!Number.isFinite(v)||Math.abs(v-source.seedPoint[i])>1e-8)||!Array.isArray(d.ports)||d.ports.length>10000||!Array.isArray(mesh.nodes)||!Array.isArray(mesh.surface))throw Error('Invalid saved internal fluid metadata');
 const caps=source.openingCaps??[],seenCaps=new Set(),seenFaces=new Set();
 if(caps.length){
  if(!Array.from(mesh.nodes).every(Number.isFinite)||mesh.nodes.length%3)throw Error('Invalid saved cap mesh nodes');
  validateCappedBoundary(mesh);
  for(let i=0;i<mesh.nodes.length;i+=3)if(caps.some(cap=>openingCapDistance(cap,mesh.nodes.slice(i,i+3))>1e-5))throw Error('Saved fluid nodes cross an opening cap outward half-space');
 }
 const planes=new Set();for(const p of d.ports){
 if(caps.length){if(seenFaces.has(p.faceTag))throw Error('Duplicate saved internal port face');seenFaces.add(p.faceTag);}
 if(p.capId!==undefined){
  const cap=caps.find(c=>c.id===p.capId),faces=mesh.surface.filter(f=>f.faceTag===p.faceTag);
  if(!cap||p.plane!==undefined||!Number.isInteger(p.faceTag)||p.faceTag<1||!faces.length||faces.some(f=>f.openingCapId!==cap.id||f.portPlane!==undefined||!Array.isArray(f.nodes)||f.nodes.length!==3||new Set(f.nodes).size!==3||f.nodes.some(i=>!Number.isInteger(i)||i<0||i>=mesh.nodes.length/3||Math.abs(openingCapDistance(cap,mesh.nodes.slice(3*i,3*i+3)))>1e-5)))throw Error('Saved opening cap geometry does not match its source plane');
  seenCaps.add(cap.id);continue;
 }
if(!Number.isInteger(p.plane)||p.plane<0||p.plane>5||!Number.isInteger(p.faceTag)||p.faceTag<1||!source.portPlanes.includes(p.plane))throw Error('Invalid saved internal port');const faces=mesh.surface.filter(f=>f.faceTag===p.faceTag),axis=p.plane%3,value=b[axis]+(p.plane>=3?b[axis+3]:0);if(!faces.length||faces.some(f=>f.portPlane!==p.plane||!Array.isArray(f.nodes)||f.nodes.length!==3||f.nodes.some(i=>!Number.isInteger(i)||i<0||i>=mesh.nodes.length/3||!Number.isFinite(mesh.nodes[3*i+axis])||Math.abs(mesh.nodes[3*i+axis]-value)>1e-5)))throw Error('Saved port geometry does not match the enclosure');planes.add(p.plane);}
 if(caps.some(cap=>!seenCaps.has(cap.id)))throw Error('Saved opening caps are incomplete');
 if(caps.length)for(const f of mesh.surface){const matches=caps.filter(cap=>f.nodes.every(i=>Math.abs(openingCapDistance(cap,mesh.nodes.slice(3*i,3*i+3)))<1e-5));if(matches.length>1||matches.length===1&&(f.openingCapId!==matches[0].id||!d.ports.some(p=>p.capId===matches[0].id&&p.faceTag===f.faceTag)))throw Error('Saved opening cap triangle is missing its declared port identity');}
 if(caps.length&&mesh.surface.some(f=>f.openingCapId!==undefined&&!d.ports.some(p=>p.capId===f.openingCapId&&p.faceTag===f.faceTag)))throw Error('Saved opening cap surface is not declared');
 if(source.portPlanes.some(p=>!planes.has(p)))throw Error('Saved internal fluid ports are incomplete');
 if(d.channel&&caps.length)throw Error('Opening caps do not establish a supported straight channel');
 if(d.channel){const c=d.channel,round=c.model==='CAD circular cylinder',rect=c.model==='CAD rectangular prism',shapeOK=round?Number.isFinite(c.radiusMm)&&c.radiusMm>0&&Math.abs(c.hydraulicDiameterM-2*c.radiusMm*.001)<1e-10&&Math.abs(c.areaM2-Math.PI*(c.radiusMm*.001)**2)<1e-10:rect&&Array.isArray(c.widthMm)&&c.widthMm.length===2&&c.widthMm.every(v=>Number.isFinite(v)&&v>0)&&Math.abs(c.areaM2-c.widthMm[0]*c.widthMm[1]*1e-6)<1e-10&&Math.abs(c.hydraulicDiameterM-2*c.widthMm[0]*c.widthMm[1]/(c.widthMm[0]+c.widthMm[1])*.001)<1e-10;
 if(!shapeOK||!Number.isInteger(c.axis)||c.axis<0||c.axis>2||source.portPlanes.length!==2||!source.portPlanes.includes(c.axis)||!source.portPlanes.includes(c.axis+3)||!['start','end','lengthM','hydraulicDiameterM','areaM2'].every(k=>Number.isFinite(c[k]))||Math.abs(c.start-b[c.axis])>1e-8||Math.abs(c.end-b[c.axis]-b[c.axis+3])>1e-8||c.lengthM<=0||Math.abs(c.lengthM-(c.end-c.start)*.001)>1e-10||Math.abs(c.areaM2*c.lengthM*1e9/d.cadVolumeMm3-1)>1e-8||!Array.isArray(c.centerMm)||c.centerMm.length!==3||!c.centerMm.every(Number.isFinite))throw Error('Invalid saved CAD channel geometry');}

}
