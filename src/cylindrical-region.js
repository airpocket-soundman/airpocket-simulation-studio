const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=v=>{const n=Math.hypot(...v);if(n<1e-12)throw Error('Invalid cylindrical axis/reference');return v.map(x=>x/n);};
export function cylindricalFrame(spec){
 if(!spec||!['origin','axis','reference'].every(k=>Array.isArray(spec[k])&&spec[k].length===3&&spec[k].every(Number.isFinite))||!['radius','tolerance','axialMin','axialMax','startDegrees','sweepDegrees'].every(k=>Number.isFinite(spec[k]))||spec.radius<=0||spec.tolerance<0||spec.axialMin>=spec.axialMax||spec.sweepDegrees<=0||spec.sweepDegrees>360)throw Error('Invalid cylindrical region dimensions');
 const axis=unit(spec.axis),reference=unit(spec.reference.map((v,k)=>v-dot(spec.reference,axis)*axis[k]));return {axis,reference,tangent:cross(axis,reference)};
}
export function cylindricalTriangles(positions,spec){
 const {axis,reference,tangent}=cylindricalFrame(spec);if(!Array.isArray(positions)||positions.length%9||!positions.every(Number.isFinite))throw Error('Invalid cylinder surface');const selected=[];
 for(let t=0;t<positions.length/9;t++){const p=[0,1,2].map(i=>positions.slice(t*9+i*3,t*9+i*3+3)),center=[0,1,2].map(k=>p.reduce((s,v)=>s+v[k],0)/3-spec.origin[k]),z=dot(center,axis),radial=center.map((v,k)=>v-z*axis[k]),radius=Math.hypot(...radial),normal=cross(p[1].map((v,k)=>v-p[0][k]),p[2].map((v,k)=>v-p[0][k])),norm=Math.hypot(...normal);
  if(norm<1e-12||Math.abs(dot(normal,axis))/norm>.25||z<spec.axialMin-1e-9||z>spec.axialMax+1e-9||Math.abs(radius-spec.radius)>spec.tolerance+1e-9)continue;
  const angle=Math.atan2(dot(radial,tangent),dot(radial,reference))*180/Math.PI,relative=((angle-spec.startDegrees)%360+360)%360;if(spec.sweepDegrees===360||relative<=spec.sweepDegrees+1e-9)selected.push(t);
 }
 return selected;
}
