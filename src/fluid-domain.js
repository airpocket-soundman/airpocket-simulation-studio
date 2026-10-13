export function validateSphere(s){
 if(s?.kind!=='sphere'||!Array.isArray(s.center)||s.center.length!==3||!s.center.every(Number.isFinite)||!Number.isFinite(s.radius)||s.radius<=0||!s.center.every(v=>Number.isFinite(v-s.radius)&&Number.isFinite(v+s.radius))||!Number.isFinite(2*s.radius))throw Error('Invalid sphere dimensions');
 return s;
}
export function enclosureBounds(enclosure){
 if(enclosure?.kind==='sphere'){validateSphere(enclosure);return [...enclosure.center.map(v=>v-enclosure.radius),2*enclosure.radius,2*enclosure.radius,2*enclosure.radius];}
 if(!Array.isArray(enclosure)||enclosure.length!==6||!enclosure.every(Number.isFinite)||enclosure.slice(3).some(v=>v<=0))throw Error('Invalid exterior enclosure');
 return enclosure;
}
export function validateFluidDomain(source){
 const b=source?.enclosure,s=source?.solid;
 if(source?.kind!=='fluidDomain'||!s||!['step','box','cylinder','boxes','sphere'].includes(s.kind))throw Error('Invalid exterior fluid domain');
 enclosureBounds(b);
 if(s.kind==='sphere')validateSphere(s);
 const box=v=>Array.isArray(v)&&v.length===6&&v.every(Number.isFinite)&&v.slice(3).every(v=>v>0);
 if(s.kind==='box'&&!box(s.bounds))throw Error('Invalid excluded solid box');
 if(s.kind==='boxes'&&(!Array.isArray(s.boxes)||!s.boxes.length||s.boxes.length>10||!s.boxes.every(box)))throw Error('Invalid excluded solid assembly');
 if(s.kind==='step'&&(typeof s.data!=='string'||s.data.length>70000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(s.data)))throw Error('Invalid excluded STEP solid');
 return source;
}
export function exteriorFluidSource(project,paddingMm){
 if(!Number.isFinite(paddingMm)||paddingMm<=0||paddingMm>10000||!project?.sourceModel||project.sourceModel.kind==='fluidDomain')throw Error('Use an original solid with positive enclosure padding (up to 10000 mm)');
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const m of project.meshes||[])for(let i=0;i<m.positions.length;i++){if(!Number.isFinite(m.positions[i]))throw Error('Invalid display geometry');const k=i%3;lo[k]=Math.min(lo[k],m.positions[i]);hi[k]=Math.max(hi[k],m.positions[i]);}
 const source={kind:'fluidDomain',solid:structuredClone(project.sourceModel),enclosure:[...lo.map(v=>v-paddingMm),...hi.map((v,k)=>v-lo[k]+2*paddingMm)]};return validateFluidDomain(source);
}
export function exteriorAcousticSource(project,paddingMm){
 const box=exteriorFluidSource(project,paddingMm),lo=box.enclosure.slice(0,3).map(v=>v+paddingMm),width=box.enclosure.slice(3).map(v=>v-2*paddingMm),center=lo.map((v,k)=>v+width[k]/2),radius=Math.hypot(...width)/2+paddingMm;
 return validateFluidDomain({...box,enclosure:{kind:'sphere',center,radius}});
}
