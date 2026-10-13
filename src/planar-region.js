export function validatePlanarRegion(d){
 if(!d||!Number.isInteger(d.axis)||d.axis<0||d.axis>2||!Number.isFinite(d.position)||!Array.isArray(d.min)||!Array.isArray(d.max)||d.min.length!==2||d.max.length!==2||![...d.min,...d.max].every(Number.isFinite)||d.max.some((v,i)=>v<=d.min[i]))throw Error('Invalid planar rectangle dimensions');
 return d;
}
export function planarCorners(d){validatePlanarRegion(d);const axes=[0,1,2].filter(k=>k!==d.axis);return [[0,0],[1,0],[1,1],[0,1]].map(c=>{const p=[0,0,0];p[d.axis]=d.position;axes.forEach((k,i)=>p[k]=c[i]?d.max[i]:d.min[i]);return p;});}
export function planarArea(d){validatePlanarRegion(d);return (d.max[0]-d.min[0])*(d.max[1]-d.min[1]);}
export function planarIntersection(positions,triangle,d){
 validatePlanarRegion(d);const axes=[0,1,2].filter(k=>k!==d.axis),p=positions.slice(triangle*9,triangle*9+9);if(p.length!==9||!Array.from(p).every(Number.isFinite))throw Error('Invalid planar display triangle');
 const tolerance=Math.max(1e-6,Math.abs(d.position)*1e-9);if([0,1,2].some(i=>Math.abs(p[3*i+d.axis]-d.position)>tolerance))return [];
 let polygon=[0,1,2].map(i=>axes.map(k=>p[3*i+k]));
 for(const [axis,bound,sign]of [[0,d.min[0],1],[0,d.max[0],-1],[1,d.min[1],1],[1,d.max[1],-1]]){const clipped=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=sign*(a[axis]-bound),db=sign*(b[axis]-bound);if(da>=0)clipped.push(a);if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);clipped.push(a.map((v,k)=>v+t*(b[k]-v)));}}polygon=clipped;}
 return polygon.map(v=>{const p=[0,0,0];p[d.axis]=d.position;axes.forEach((k,i)=>p[k]=v[i]);return p;});
}
export function planarTriangles(positions,d){
 let area=0;const triangles=[];for(let t=0;t<positions.length/9;t++){const p=planarIntersection(positions,t,d);if(p.length<3)continue;let a=0;for(let i=1;i<p.length-1;i++){const u=p[i].map((v,k)=>v-p[0][k]),v=p[i+1].map((v,k)=>v-p[0][k]);a+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])*.5;}if(a>1e-12){triangles.push(t);area+=a;}}
 if(Math.abs(area/planarArea(d)-1)>1e-6)throw Error('Planar rectangle must be covered by one planar display surface');return triangles;
}

export function fragmentPlanarRegions(g,source,regions){
 if(!regions.length)return null;if(!['step','box'].includes(source.kind))throw Error('Exact planar patches require a STEP or box solid');if(regions.length>20)throw Error('At most twenty exact planar patches are supported');
 g.model.occ.synchronize();const volumes=g.model.getEntities(3).dimTags;if(volumes.length!==2)throw Error('Exact planar patches currently require a single CAD volume');const faces=g.model.getBoundary(volumes,false,false,false).outDimTags,tools=[];
 for(const {region:d}of regions){const corners=planarCorners(d),axes=[0,1,2].filter(k=>k!==d.axis);const candidates=[];for(let i=0;i<faces.length;i+=2){const tag=Math.abs(faces[i+1]),b=g.model.getBoundingBox(2,tag),keys=['x','y','z'];if(g.model.getType(2,tag).entityType!=='Plane'||Math.abs(b[keys[d.axis]+'min']-d.position)>1e-5||Math.abs(b[keys[d.axis]+'max']-d.position)>1e-5)continue;const samples=[...corners,...corners.map((v,j)=>v.map((x,k)=>(x+corners[(j+1)%4][k])/2)),corners[0].map((x,k)=>(x+corners[2][k])/2)];if(samples.every(p=>g.model.isInside(2,tag,p,false)>0)&&axes.every((k,j)=>d.min[j]>=b[keys[k]+'min']-1e-6&&d.max[j]<=b[keys[k]+'max']+1e-6))candidates.push(tag);}
  if(candidates.length!==1)throw Error('Planar rectangle must lie on one external planar CAD face');const points=corners.map(p=>g.model.occ.addPoint(...p)),lines=points.map((p,i)=>g.model.occ.addLine(p,points[(i+1)%4])),wire=g.model.occ.addWire(lines,-1,true),surface=g.model.occ.addPlaneSurface([wire]);tools.push(2,surface);
 }
 const objects=[...volumes,...faces.map((v,i)=>i%2?Math.abs(v):v)],out=g.model.occ.fragment(objects,tools,-1,true,true);g.model.occ.synchronize();const originalTags=new Map();for(let i=0;i<faces.length;i+=2){const old=Math.abs(faces[i+1]),map=out.outDimTagsMap[1+i/2];for(let j=0;j<map.length;j+=2)if(map[j]===2){const tag=Math.abs(map[j+1]);if(originalTags.has(tag)&&originalTags.get(tag)!==old)throw Error('Ambiguous CAD face after planar fragmentation');originalTags.set(tag,old);}}
 const boundary=new Set(g.model.getBoundary(g.model.getEntities(3).dimTags,false,false,false).outDimTags.filter((v,i)=>i%2).map(Math.abs));const patches=regions.map(({region,conditionIndex},i)=>{const map=out.outDimTagsMap[objects.length/2+i],tags=[];for(let j=0;j<map.length;j+=2)if(map[j]===2)tags.push(Math.abs(map[j+1]));const area=tags.reduce((sum,t)=>sum+g.model.occ.getMass(2,t).mass,0);if(!tags.length||tags.some(t=>!boundary.has(t))||Math.abs(area/planarArea(region)-1)>1e-7)throw Error('Planar CAD patch area or boundary verification failed');return {conditionIndex,region:structuredClone(region),tags,areaMm2:area};});return {originalTags,patches};
}

export function validatePlanarMesh(mesh,project){
 const expected=(project?.conditions||[]).flatMap((c,i)=>c.planarRegion?[[i,c.planarRegion]]:[]);if(!expected.length){if(mesh?.planarPatches?.length)throw Error('Unexpected saved planar patches');return;}
 if(!Array.isArray(mesh.planarPatches)||mesh.planarPatches.length!==expected.length)throw Error('Missing saved planar patches');
 for(const [index,d]of expected){const p=mesh.planarPatches.find(p=>p.conditionIndex===index);if(!p||JSON.stringify(p.region)!==JSON.stringify(d)||!Array.isArray(p.tags)||!p.tags.length||!p.tags.every(Number.isInteger)||!Number.isFinite(p.areaMm2)||Math.abs(p.areaMm2/planarArea(d)-1)>1e-7)throw Error('Invalid saved planar patch');let area=0;const axes=[0,1,2].filter(k=>k!==d.axis);for(const f of mesh.surface){if(!f.patchConditions?.includes(index))continue;const points=f.nodes.map(i=>mesh.nodes.slice(3*i,3*i+3));if(points.some(v=>Math.abs(v[d.axis]-d.position)>1e-6||axes.some((k,j)=>v[k]<d.min[j]-1e-6||v[k]>d.max[j]+1e-6)))throw Error('Saved planar patch extends outside its dimensions');const a=points[1].map((v,k)=>v-points[0][k]),b=points[2].map((v,k)=>v-points[0][k]);area+=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])*.5;}if(Math.abs(area/planarArea(d)-1)>1e-7)throw Error('Saved planar patch area mismatch');}
}
