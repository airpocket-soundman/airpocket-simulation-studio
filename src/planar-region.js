import {frameFromEuler} from './constraints.js';
export function validatePlanarRegion(d){
 if(!d||!Array.isArray(d.min)||!Array.isArray(d.max)||d.min.length!==2||d.max.length!==2||![...d.min,...d.max].every(Number.isFinite)||d.max.some((v,i)=>v<=d.min[i]))throw Error('Invalid planar rectangle dimensions');
 if(d.rotationDegrees!==undefined&&!d.frame)throw Error('Planar rotation controls require a matching saved frame');
 if(d.frame){const f=d.frame;if(!['origin','u','v'].every(k=>Array.isArray(f[k])&&f[k].length===3&&f[k].every(Number.isFinite))||Math.abs(Math.hypot(...f.u)-1)>1e-8||Math.abs(Math.hypot(...f.v)-1)>1e-8||Math.abs(f.u.reduce((s,v,k)=>s+v*f.v[k],0))>1e-8)throw Error('Planar frame axes must be finite orthonormal vectors');if(d.rotationDegrees!==undefined){if(!Number.isFinite(d.position)||!Number.isInteger(d.axis)||d.axis<0||d.axis>2)throw Error('Invalid planar rotation controls');const axes=frameFromEuler(d.rotationDegrees,d.axis).axes,across=[0,1,2].filter(k=>k!==d.axis);if(f.u.some((v,k)=>Math.abs(v-axes[across[0]][k])>1e-8)||f.v.some((v,k)=>Math.abs(v-axes[across[1]][k])>1e-8)||f.origin.some((v,k)=>Math.abs(v-d.position*axes[d.axis][k])>1e-7))throw Error('Planar rotation controls do not match the saved frame');}}
 else if(!Number.isInteger(d.axis)||d.axis<0||d.axis>2||!Number.isFinite(d.position))throw Error('Invalid planar rectangle dimensions');
 return d;
}
export function planarRegionFromEuler(axis,position,rotationDegrees,min,max){const axes=frameFromEuler(rotationDegrees,axis).axes,across=[0,1,2].filter(k=>k!==axis);return validatePlanarRegion({axis,position,rotationDegrees:[...rotationDegrees],frame:{origin:axes[axis].map(v=>v*position),u:axes[across[0]],v:axes[across[1]]},min:[...min],max:[...max]});}
export function planarFrame(d){validatePlanarRegion(d);let origin,u,v;if(d.frame)({origin,u,v}=d.frame);else{const axes=[0,1,2].filter(k=>k!==d.axis);origin=[0,0,0];origin[d.axis]=d.position;u=[0,0,0];u[axes[0]]=1;v=[0,0,0];v[axes[1]]=1;}return {origin,u,v,normal:[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]};}
export function planarCoordinates(d,point){const {origin,u,v,normal}=planarFrame(d),p=point.map((x,k)=>x-origin[k]),dot=a=>a.reduce((s,x,k)=>s+x*p[k],0);return {u:dot(u),v:dot(v),distance:dot(normal)};}
export function planarCorners(d){const {origin,u,v}=planarFrame(d);return [[0,0],[1,0],[1,1],[0,1]].map(c=>origin.map((x,k)=>x+(c[0]?d.max[0]:d.min[0])*u[k]+(c[1]?d.max[1]:d.min[1])*v[k]));}
export function planarArea(d){validatePlanarRegion(d);return (d.max[0]-d.min[0])*(d.max[1]-d.min[1]);}
export function planarIntersection(positions,triangle,d){
 const frame=planarFrame(d),p=positions.slice(triangle*9,triangle*9+9);if(p.length!==9||!Array.from(p).every(Number.isFinite))throw Error('Invalid planar display triangle');
 const coordinates=[0,1,2].map(i=>planarCoordinates(d,Array.from(p.slice(3*i,3*i+3)))),tolerance=Math.max(1e-5,...Array.from(p,x=>Math.abs(x)*1e-7));if(coordinates.some(v=>Math.abs(v.distance)>tolerance))return [];
 let polygon=coordinates.map(p=>[p.u,p.v]);
 for(const [axis,bound,sign]of [[0,d.min[0],1],[0,d.max[0],-1],[1,d.min[1],1],[1,d.max[1],-1]]){const clipped=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=sign*(a[axis]-bound),db=sign*(b[axis]-bound);if(da>=0)clipped.push(a);if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);clipped.push(a.map((v,k)=>v+t*(b[k]-v)));}}polygon=clipped;}
 return polygon.map(p=>frame.origin.map((x,k)=>x+p[0]*frame.u[k]+p[1]*frame.v[k]));
}
export function planarTriangles(positions,d){
 let area=0;const triangles=[];for(let t=0;t<positions.length/9;t++){const p=planarIntersection(positions,t,d);if(p.length<3)continue;let a=0;for(let i=1;i<p.length-1;i++){const u=p[i].map((v,k)=>v-p[0][k]),v=p[i+1].map((v,k)=>v-p[0][k]);a+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])*.5;}if(a>1e-12){triangles.push(t);area+=a;}}
 if(Math.abs(area/planarArea(d)-1)>1e-6)throw Error('Planar rectangle must be covered by one planar display surface');return triangles;
}

export function validatePlanarMesh(mesh,project){
 const expected=(project?.conditions||[]).flatMap((c,i)=>c.planarRegion?[[i,c.planarRegion]]:[]);if(!expected.length){if(mesh?.planarPatches?.length)throw Error('Unexpected saved planar patches');return;}
 if(!Array.isArray(mesh.planarPatches)||mesh.planarPatches.length!==expected.length)throw Error('Missing saved planar patches');
 for(const [index,d]of expected){const p=mesh.planarPatches.find(p=>p.conditionIndex===index);if(!p||JSON.stringify(p.region)!==JSON.stringify(d)||!Array.isArray(p.tags)||!p.tags.length||!p.tags.every(Number.isInteger)||!Number.isFinite(p.areaMm2)||Math.abs(p.areaMm2/planarArea(d)-1)>1e-7)throw Error('Invalid saved planar patch');let area=0;for(const f of mesh.surface){if(!f.patchConditions?.includes(index))continue;const points=f.nodes.map(i=>mesh.nodes.slice(3*i,3*i+3));if(points.some(v=>{const c=planarCoordinates(d,v);return Math.abs(c.distance)>1e-6||c.u<d.min[0]-1e-6||c.u>d.max[0]+1e-6||c.v<d.min[1]-1e-6||c.v>d.max[1]+1e-6;}))throw Error('Saved planar patch extends outside its dimensions');const a=points[1].map((v,k)=>v-points[0][k]),b=points[2].map((v,k)=>v-points[0][k]);area+=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])*.5;}if(Math.abs(area/planarArea(d)-1)>1e-7)throw Error('Saved planar patch area mismatch');}
}
