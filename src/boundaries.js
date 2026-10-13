import {outwardSurfaceNormals} from './surface-loads.js';
import {areaOfTriangle} from './regions.js';
function dist2(x,y,z,p,k){
 const ax=p[k],ay=p[k+1],az=p[k+2],ux=p[k+3]-ax,uy=p[k+4]-ay,uz=p[k+5]-az,vx=p[k+6]-ax,vy=p[k+7]-ay,vz=p[k+8]-az,wx=x-ax,wy=y-ay,wz=z-az;
 const uu=ux*ux+uy*uy+uz*uz,uv=ux*vx+uy*vy+uz*vz,vv=vx*vx+vy*vy+vz*vz,wu=wx*ux+wy*uy+wz*uz,wv=wx*vx+wy*vy+wz*vz,d=uu*vv-uv*uv;
 if(d>1e-20){const a=(wu*vv-wv*uv)/d,b=(wv*uu-wu*uv)/d;if(a>=0&&b>=0&&a+b<=1){const dx=wx-a*ux-b*vx,dy=wy-a*uy-b*vy,dz=wz-a*uz-b*vz;return dx*dx+dy*dy+dz*dz;}}
 let best=Infinity;for(const [i,j]of [[k,k+3],[k+3,k+6],[k+6,k]]){const ex=p[j]-p[i],ey=p[j+1]-p[i+1],ez=p[j+2]-p[i+2],den=ex*ex+ey*ey+ez*ez,t=Math.max(0,Math.min(1,den?((x-p[i])*ex+(y-p[i+1])*ey+(z-p[i+2])*ez)/den:0));best=Math.min(best,(x-p[i]-t*ex)**2+(y-p[i+1]-t*ey)**2+(z-p[i+2]-t*ez)**2);}return best;
}
export function transferConditions(project,mesh,{areaTolerance=.15}={}){
 const normals=project.conditions.some(c=>['pressure','normalTraction'].includes(c.type))?outwardSurfaceNormals(mesh):null;const matches=mesh.surface.map((s,si)=>{const center=[0,0,0];for(const i of s.nodes)for(let k=0;k<3;k++)center[k]+=mesh.nodes[i*3+k]/3;let best=Infinity,meshId=-1,triangle=-1;project.meshes.forEach((m,mi)=>{for(let t=0;t<m.positions.length/9;t++){const d=dist2(...center,m.positions,t*9);if(d<best){best=d;meshId=mi;triangle=t;}}});const positions=s.nodes.flatMap(i=>mesh.nodes.slice(i*3,i*3+3));return {surface:s,normal:normals?.[si],meshId,triangle,distanceMm:Math.sqrt(best),area:areaOfTriangle(positions,0)};});
 const fixed=new Set(),forces=new Map(),reports=[],temperatures=new Map(),heatFlux=new Map(),acousticPressures=new Map(),convection=[],convFaces=new Set();
 for(const c of project.conditions){const selected=new Map(c.regions.map(r=>[r.mesh,new Set(r.triangles)])),mapped=matches.filter(m=>selected.get(m.meshId)?.has(m.triangle));let originalArea=0;for(const r of c.regions)for(const t of r.triangles)originalArea+=areaOfTriangle(project.meshes[r.mesh].positions,t);const mappedArea=mapped.reduce((a,m)=>a+m.area,0),error=originalArea?Math.abs(mappedArea-originalArea)/originalArea:1;
 if(!mapped.length||error>areaTolerance)throw Error(`Selected region transfer error ${(error*100).toFixed(1)}%; refine the mesh (tolerance ${(areaTolerance*100).toFixed(0)}%)`);
 const maxDistance=Math.max(...mapped.map(m=>m.distanceMm));if(maxDistance>mesh.size*.15)throw Error('Surface projection distance is too large; refine the mesh');
 reports.push({type:c.type,originalAreaMm2:originalArea,mappedAreaMm2:mappedArea,relativeAreaError:error,maxProjectionDistanceMm:maxDistance,approximation:'surface triangle centroid projection'});
 if(c.type==='fixed')for(const m of mapped)for(const i of m.surface.nodes)fixed.add(i);
 else if(c.type==='force'){const norm=Math.hypot(...c.direction);for(const m of mapped)for(const i of m.surface.nodes){const v=forces.get(i)||[0,0,0];for(let k=0;k<3;k++)v[k]+=c.value*c.direction[k]/norm*m.area/mappedArea/3;forces.set(i,v);}}
 else if(['pressure','normalTraction'].includes(c.type)){const signed=c.type==='pressure'?-c.value:c.value;for(const m of mapped)for(const i of m.surface.nodes){const v=forces.get(i)||[0,0,0];for(let k=0;k<3;k++)v[k]+=signed*m.area*1e-6*m.normal[k]/3;forces.set(i,v);}}
 else if(c.type==='temperature')for(const m of mapped)for(const i of m.surface.nodes){if(temperatures.has(i)&&Math.abs(temperatures.get(i)-c.value)>1e-8)throw Error('Conflicting temperatures on a shared node');temperatures.set(i,c.value);}
 else if(c.type==='convection'){for(const m of mapped){const key=m.surface.nodes.slice().sort((a,b)=>a-b).join(',');if(convFaces.has(key))throw Error('Overlapping convection regions');convFaces.add(key);convection.push({nodes:[...m.surface.nodes],areaM2:m.area*1e-6,coefficient:c.value,ambientTemperature:c.ambientTemperature});}}
 else if(c.type==='heatPower')for(const m of mapped)for(const i of m.surface.nodes)heatFlux.set(i,(heatFlux.get(i)||0)+c.value*m.area/mappedArea/3);
 else if(c.type==='heatFlux')for(const m of mapped)for(const i of m.surface.nodes)heatFlux.set(i,(heatFlux.get(i)||0)+c.value*m.area*1e-6/3);
 else if(c.type==='acousticPressure')for(const m of mapped)for(const i of m.surface.nodes){if(acousticPressures.has(i)&&Math.abs(acousticPressures.get(i)-c.value)>1e-8)throw Error('Conflicting acoustic pressure regions');acousticPressures.set(i,c.value);}
 else throw Error('Unsupported boundary condition');
 }
 return {fixed:[...fixed],forces:[...forces].map(([node,value])=>({node,value})),temperatures:[...temperatures],heatFlux:[...heatFlux],acousticPressures:[...acousticPressures],convection,reports};
}
