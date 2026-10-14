import {validateProject,areaOfTriangle} from './regions.js';
import {planarTriangles,planarArea} from './planar-region.js';
import {cylinderPatchArea} from './cylindrical-cad.js';
import {cylindricalTriangles} from './cylindrical-region.js';
import {requireResolvedCadConditions} from './cad-update-state.js';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),key=p=>p.map(v=>Object.is(v,-0)?0:v).join(','),lex=(a,b)=>{for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
const near=(a,b,tol)=>a.every((v,i)=>Math.abs(v-b[i])<=tol);
function triangleKey(points){const keys=points.map(key),start=keys.indexOf([...keys].sort()[0]);return [0,1,2].map(i=>keys[(start+i)%3]).join('|');}
function outline(face,positions){
 const links=new Map(),edges=new Map(),points=new Map();
 for(const t of face.triangles){const p=[0,1,2].map(i=>positions.slice(t*9+3*i,t*9+3*i+3));for(let i=0;i<3;i++){const a=key(p[i]),b=key(p[(i+1)%3]);points.set(a,p[i]);points.set(b,p[(i+1)%3]);const pair=[a,b].sort().join('|');if(a===b)return null;const edge=edges.get(pair);if(edge){edge.count++;if(edge.count>2)return null;}else edges.set(pair,{a,b,count:1});}}
 for(const {a,b,count}of edges.values())if(count===1){for(const [x,y]of [[a,b],[b,a]]){if(!links.has(x))links.set(x,[]);links.get(x).push(y);}}
 if(!links.size||[...links.values()].some(v=>v.length!==2))return null;const visited=new Set(),loops=[];
 for(const first of links.keys()){
  if(visited.has(first))continue;const loop=[];let current=first,previous=null;
  do{if(visited.has(current))return null;visited.add(current);loop.push(points.get(current));const next=links.get(current).find(p=>p!==previous);previous=current;current=next;}while(current!==first);
  if(loop.length<3)return null;let changed=true;while(changed&&loop.length>3){changed=false;for(let i=0;i<loop.length;i++){const a=loop[(i+loop.length-1)%loop.length],b=loop[i],c=loop[(i+1)%loop.length],ac=c.map((v,k)=>v-a[k]),ab=b.map((v,k)=>v-a[k]),length=dot(ac,ac),q=dot(ab,ac)/length;if(length>0&&q>=0&&q<=1&&Math.hypot(...ab.map((v,k)=>v-q*ac[k]))<=face.tolerance){loop.splice(i,1);changed=true;break;}}}
  const start=loop.reduce((a,v,i)=>lex(v,loop[a])<0?i:a,0),forward=loop.map((_,i)=>loop[(start+i)%loop.length]),reverse=loop.map((_,i)=>loop[(start-i+loop.length)%loop.length]);loops.push(lex(forward[1],reverse[1])<=0?forward:reverse);
 }
 return loops.sort((a,b)=>lex(a[0],b[0])||a.length-b.length);
}
function facesOf(meshes){
 const faces=[];
 meshes.forEach((mesh,meshIndex)=>{
  if(mesh.kind!==undefined&&mesh.kind!=='cad')throw Error('CAD update requires original STEP display faces');const groups=new Map();mesh.faceIds.forEach((id,t)=>{if(id<0)throw Error('CAD update requires named CAD faces');if(!groups.has(id)){if(faces.length+groups.size>=2000)throw Error('CAD update limit is 2000 display faces');groups.set(id,[]);}groups.get(id).push(t);});
  for(const [faceId,triangles]of groups){const f={mesh:meshIndex,faceId,triangles,area:0,centroid:[0,0,0],normal:[0,0,0],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],triangleKeys:[],planar:true};
   let firstNormal,anchor;for(const t of triangles){const p=[0,1,2].map(i=>mesh.positions.slice(t*9+3*i,t*9+3*i+3)),a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]),cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...cross),area=length/2;if(!Number.isFinite(area)||!(area>1e-14))throw Error('CAD update cannot compare degenerate display faces');const normal=cross.map(v=>v/length);firstNormal??=normal;anchor??=p[0];if(dot(firstNormal,normal)<1-1e-7)f.planar=false;f.area+=area;for(let k=0;k<3;k++){f.centroid[k]+=area*(p[0][k]+p[1][k]+p[2][k])/3;f.normal[k]+=cross[k]/2;for(const point of p){f.min[k]=Math.min(f.min[k],point[k]);f.max[k]=Math.max(f.max[k],point[k]);}}f.triangleKeys.push(triangleKey(p));}
   f.centroid=f.centroid.map(v=>v/f.area);f.normal=f.normal.map(v=>v/f.area);f.span=Math.max(...f.max.map((v,k)=>v-f.min[k]));f.tolerance=1e-7*Math.max(1,f.span);if(f.planar&&triangles.some(t=>[0,1,2].some(i=>Math.abs(dot(mesh.positions.slice(t*9+3*i,t*9+3*i+3).map((v,k)=>v-anchor[k]),firstNormal))>f.tolerance)))f.planar=false;
   f.outline=f.planar?outline(f,mesh.positions):null;f.triangleKeys.sort();faces.push(f);
  }
 });if(faces.length>2000)throw Error('CAD update limit is 2000 display faces');return faces;
}
function sameFace(a,b){
 const tol=Math.max(a.tolerance,b.tolerance);if(Math.abs(a.area/b.area-1)>1e-6||!near(a.centroid,b.centroid,tol)||!near(a.min,b.min,tol)||!near(a.max,b.max,tol)||!near(a.normal,b.normal,1e-6))return false;
 if(a.planar&&b.planar&&a.outline&&b.outline)return a.outline.length===b.outline.length&&a.outline.every((loop,i)=>loop.length===b.outline[i].length&&loop.every((p,j)=>near(p,b.outline[i][j],tol)));
 return a.triangleKeys.length===b.triangleKeys.length&&a.triangleKeys.every((v,i)=>v===b.triangleKeys[i]);
}
export function planCadUpdate(project,replacement){
 validateProject(project);requireResolvedCadConditions(project);
 if(project.sourceModel?.kind!=='step'||replacement?.sourceModel?.kind!=='step'||project.study?.temperatureSource||project.study?.vibrationSource)throw Error('CAD update requires STEP solids without saved coupled fields');
 validateProject({version:1,sourceModel:replacement.sourceModel,meshes:replacement.meshes,conditions:[]});
 const oldFaces=facesOf(project.meshes),newFaces=facesOf(replacement.meshes),matches=new Map(),reverse=new Map();
 for(const old of oldFaces){const candidates=newFaces.filter(f=>sameFace(old,f));matches.set(old,candidates);for(const next of candidates){if(!reverse.has(next))reverse.set(next,[]);reverse.get(next).push(old);}}
 const output=structuredClone(project);output.name=replacement.name??project.name;output.meshes=structuredClone(replacement.meshes);output.sourceModel=structuredClone(replacement.sourceModel);output.selection=output.meshes.map(()=>[]);delete output.planarRegion;delete output.cylindricalRegion;
 const reports=[];
 output.conditions=project.conditions.map((original,index)=>{
  const c=structuredClone(original),refs=[],regions=new Map();let reason;
  for(const region of c.regions){const selected=new Set(region.triangles),faces=oldFaces.filter(f=>f.mesh===region.mesh&&f.triangles.some(t=>selected.has(t)));for(const old of faces){refs.push({mesh:old.mesh,faceId:old.faceId});const candidates=matches.get(old);if(candidates.length!==1||reverse.get(candidates[0])?.length!==1){reason??=candidates.length===0?'missing-face':'ambiguous-face';continue;}const next=candidates[0];let triangles;
    if(c.planarRegion||c.cylindricalRegion){const spec={...(c.planarRegion??c.cylindricalRegion),mesh:next.mesh};try{triangles=c.planarRegion?planarTriangles(output.meshes[next.mesh].positions,spec):cylindricalTriangles(output.meshes[next.mesh].positions,spec);if(!triangles.length)throw Error('empty');if(c.planarRegion)c.planarRegion=spec;else c.cylindricalRegion=spec;}catch{reason??='changed-dimensions';continue;}}
    else if(old.triangles.every(t=>selected.has(t)))triangles=next.triangles;
    else {const wanted=old.triangles.filter(t=>selected.has(t)).map(t=>triangleKey([0,1,2].map(i=>project.meshes[old.mesh].positions.slice(t*9+3*i,t*9+3*i+3))));triangles=next.triangles.filter(t=>wanted.includes(triangleKey([0,1,2].map(i=>output.meshes[next.mesh].positions.slice(t*9+3*i,t*9+3*i+3)))));if(triangles.length!==wanted.length){reason??='partial-selection';continue;}}
    if(!regions.has(next.mesh))regions.set(next.mesh,new Set());triangles.forEach(t=>regions.get(next.mesh).add(t));
   }}
  const previousAreaMm2=original.planarRegion?planarArea(original.planarRegion):original.cylindricalRegion?.exactCad?cylinderPatchArea(original.cylindricalRegion):original.regions.reduce((sum,r)=>sum+r.triangles.reduce((a,t)=>a+areaOfTriangle(project.meshes[r.mesh].positions,t),0),0);
  if(!regions.size)reason??='missing-face';if(c.type==='thermalContact'&&regions.size!==2)reason??='ambiguous-face';
  if(reason){const dimensions={planar:original.planarRegion,cylindrical:original.cylindricalRegion};c.cadUpdateRequired={version:1,reason,previousAreaMm2,faces:refs,...(original.planarRegion||original.cylindricalRegion?{previousDimensions:JSON.stringify(dimensions)}:{})};c.regions=[];delete c.planarRegion;delete c.cylindricalRegion;}
  else c.regions=[...regions].map(([mesh,triangles])=>({mesh,triangles:[...triangles].sort((a,b)=>a-b)}));
  reports.push({index,type:c.type,status:reason?'needs-reselection':'matched',reason:reason??null,previousAreaMm2,regions:structuredClone(c.regions),faces:refs});return c;
 });
 validateProject(output);return {project:output,reports,matched:reports.filter(r=>r.status==='matched').length,pending:reports.filter(r=>r.status!=='matched').length};
}
