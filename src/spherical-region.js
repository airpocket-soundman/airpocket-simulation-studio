const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const n=Math.hypot(...v);if(!Number.isFinite(n)||n<1e-12)throw Error('Invalid spherical axis/reference');return v.map(x=>x/n);};
export function sphericalFrame(d){
 if(!d||d.exactCad!==true||!['center','axis','reference'].every(k=>Array.isArray(d[k])&&d[k].length===3&&d[k].every(Number.isFinite))||!['radius','tolerance','latitudeMin','latitudeMax','startDegrees','sweepDegrees'].every(k=>Number.isFinite(d[k]))||d.radius<=0||d.tolerance<0||d.latitudeMin< -90||d.latitudeMax>90||d.latitudeMin>=d.latitudeMax||d.sweepDegrees<=0||d.sweepDegrees>360)throw Error('Invalid exact spherical region dimensions');
 if(d.center.some(v=>!Number.isFinite(v+d.radius)||!Number.isFinite(v-d.radius))||!Number.isFinite(d.radius*d.radius*d.sweepDegrees*Math.PI/180))throw Error('Spherical dimensions overflow');
 const axis=unit(d.axis),reference=unit(d.reference.map((v,k)=>v-dot(d.reference,axis)*axis[k]));return {axis,reference,tangent:cross(axis,reference)};
}
export function sphericalPoint(d,latitude,longitude){const {axis,reference,tangent}=sphericalFrame(d),p=latitude*Math.PI/180,a=(longitude%360)*Math.PI/180;return d.center.map((v,k)=>v+d.radius*(Math.sin(p)*axis[k]+Math.cos(p)*(Math.cos(a)*reference[k]+Math.sin(a)*tangent[k])));}
export function sphericalContains(d,point,{tolerance=1e-6}={}){
 const {axis,reference,tangent}=sphericalFrame(d);if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))return false;const p=point.map((v,k)=>v-d.center[k]),r=Math.hypot(...p);if(!Number.isFinite(r)||r<=0||Math.abs(r-d.radius)>tolerance)return false;
 const lat=Math.asin(Math.max(-1,Math.min(1,dot(p,axis)/r)))*180/Math.PI,angleTolerance=tolerance/d.radius*180/Math.PI;if(lat<d.latitudeMin-angleTolerance||lat>d.latitudeMax+angleTolerance)return false;
 const radial=p.map((v,k)=>v-dot(p,axis)*axis[k]);if(Math.hypot(...radial)<=tolerance)return true;
 const relative=((Math.atan2(dot(p,tangent),dot(p,reference))*180/Math.PI-d.startDegrees%360)%360+360)%360;
 return d.sweepDegrees===360||relative<=d.sweepDegrees+angleTolerance||relative>=360-angleTolerance;
}
// Display selection is a preview of the exact region. CAD fragmentation, not
// display triangle clipping, supplies the analysis boundary and exact area.
export function sphericalTriangles(positions,d){
 const {axis,reference,tangent}=sphericalFrame(d);if(!Array.isArray(positions)||positions.length%9||!positions.every(Number.isFinite))throw Error('Invalid spherical display surface');const result=[];
 for(let t=0;t<positions.length/9;t++){
  const points=[0,1,2].map(i=>positions.slice(t*9+i*3,t*9+i*3+3)),q=points.map(p=>p.map((v,k)=>v-d.center[k]));
  if(q.some(p=>Math.abs(Math.hypot(...p)-d.radius)>d.tolerance+1e-6))continue;
  const latitude=q.map(p=>Math.asin(Math.max(-1,Math.min(1,dot(p,axis)/d.radius)))*180/Math.PI);
  if(Math.max(...latitude)<=d.latitudeMin+1e-9||Math.min(...latitude)>=d.latitudeMax-1e-9)continue;
  if(d.sweepDegrees===360){result.push(t);continue;}
  const nonPolar=q.filter(p=>Math.hypot(...p.map((v,k)=>v-dot(p,axis)*axis[k]))>1e-6),angles=nonPolar.map(p=>((Math.atan2(dot(p,tangent),dot(p,reference))*180/Math.PI-d.startDegrees%360)%360+360)%360);
  if(!angles.length)continue;const anchor=angles[0],unwrapped=angles.map(a=>anchor+((a-anchor+540)%360-180));
  if([-360,0,360].some(shift=>Math.max(...unwrapped)+shift>1e-9&&Math.min(...unwrapped)+shift<d.sweepDegrees-1e-9))result.push(t);
 }
 return result;
}
