export function validateFluidDomain(source){
 const b=source?.enclosure,s=source?.solid;
 if(source?.kind!=='fluidDomain'||!Array.isArray(b)||b.length!==6||!b.every(Number.isFinite)||b.slice(3).some(v=>v<=0)||!s||!['step','box','cylinder','boxes'].includes(s.kind))throw Error('Invalid exterior fluid domain');
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
