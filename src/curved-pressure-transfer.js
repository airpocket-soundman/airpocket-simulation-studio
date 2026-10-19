// Conservative curved-interface pressure transfer (discrete faceted integral only).
// Oriented triangles carry a face-fixed complex pressure; the fluid -> structure operator
// distributes -p*n * area/3 to each vertex, and its exact transpose turns nodal displacement
// back into a per-face normal-displacement integral with the same weights.
// Contract: nodes in mm, pressure in Pa as {real,imag}, displacement in m, force in N, work in J.
// NOT wired into any solver, worker, MCP or UI path, and NOT a smooth-surface accuracy claim.

const LENGTH_UNITS=['mm'],PRESSURE_UNITS=['Pa'],SURFACES=['open','closed'];

function facetGeometry(load){
  const {nodes,triangles}=load,normals=[],areasMm2=[],faces=new Set();
  for(const t of triangles){
    const key=[...t].sort((a,b)=>a-b).join(',');
    if(faces.has(key))throw Error('Curved pressure transfer rejects a duplicate face');faces.add(key);
    const [a,b,c]=t.map(i=>nodes.slice(3*i,3*i+3)),u=b.map((v,k)=>v-a[k]),w=c.map((v,k)=>v-a[k]),cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],length=Math.hypot(...cross);
    if(!(length>0)||!Number.isFinite(length))throw Error('Curved pressure transfer rejects a degenerate face');
    normals.push(cross.map(v=>v/length));areasMm2.push(length*.5);
  }
  if(load.surface==='closed'){
    const edges=new Map();
    for(const t of triangles)for(const [i,j]of [[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]]){const key=i<j?`${i},${j}`:`${j},${i}`,edge=edges.get(key)||{count:0,turn:0};edge.count++;edge.turn+=i<j?1:-1;edges.set(key,edge);}
    for(const edge of edges.values()){if(edge.count!==2)throw Error('Curved pressure transfer rejects an open-edge closed shell');if(edge.turn!==0)throw Error('Curved pressure transfer rejects an inconsistent closed-shell orientation');}
  }
  return {nodeCount:nodes.length/3,faceCount:triangles.length,normals,areasMm2};
}

export function validateCurvedPressure(load){
  if(!load||typeof load!=='object')throw Error('Curved pressure transfer requires an explicit contract');
  if(!LENGTH_UNITS.includes(load.lengthUnit)||!PRESSURE_UNITS.includes(load.pressureUnit))throw Error('Curved pressure transfer rejects an unknown length or pressure unit');
  if(!SURFACES.includes(load.surface))throw Error('Curved pressure transfer requires a declared open or closed surface');
  const {nodes,triangles,pressure}=load;
  if(!Array.isArray(nodes)||nodes.length<9||nodes.length%3||!nodes.every(Number.isFinite))throw Error('Curved pressure transfer requires finite mm nodes');
  const nodeCount=nodes.length/3;
  if(!Array.isArray(triangles)||!triangles.length||!triangles.every(t=>Array.isArray(t)&&t.length===3&&t.every(i=>Number.isInteger(i)&&i>=0&&i<nodeCount)&&new Set(t).size===3))throw Error('Curved pressure transfer requires oriented triangle node indices');
  if(!Array.isArray(pressure)||pressure.length!==triangles.length)throw Error('Curved pressure transfer requires one pressure per oriented face');
  if(!pressure.every(p=>p&&Number.isFinite(p.real)&&Number.isFinite(p.imag)))throw Error('Curved pressure transfer requires finite complex pressure in Pa');
  facetGeometry(load);return load;
}

const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Fluid -> structure: face-fixed complex pressure -> complex nodal force (N), normals, total area and force/moment about the origin. Input is not modified. */
export function pressureNodalForces(load){
  validateCurvedPressure(load);
  const {nodes,triangles,pressure}=load,{nodeCount,faceCount,normals,areasMm2}=facetGeometry(load),forceReal=Array(nodeCount*3).fill(0),forceImag=Array(nodeCount*3).fill(0);
  for(let f=0;f<faceCount;f++){
    const weight=areasMm2[f]*1e-6/3,n=normals[f],tr=-pressure[f].real,ti=-pressure[f].imag;
    for(const i of triangles[f])for(let k=0;k<3;k++){forceReal[i*3+k]+=weight*n[k]*tr;forceImag[i*3+k]+=weight*n[k]*ti;}
  }
  const resultantReal=[0,0,0],resultantImag=[0,0,0],momentReal=[0,0,0],momentImag=[0,0,0];
  for(let i=0;i<nodeCount;i++){
    const r=nodes.slice(3*i,3*i+3).map(v=>v*1e-3),fr=forceReal.slice(3*i,3*i+3),fi=forceImag.slice(3*i,3*i+3),mr=cross(r,fr),mi=cross(r,fi);
    for(let k=0;k<3;k++){resultantReal[k]+=fr[k];resultantImag[k]+=fi[k];momentReal[k]+=mr[k];momentImag[k]+=mi[k];}
  }
  return {forceReal,forceImag,normals,areasMm2,totalAreaMm2:areasMm2.reduce((s,v)=>s+v,0),resultantReal,resultantImag,momentReal,momentImag,metadata:{lengthUnit:'mm',pressureUnit:'Pa',surface:load.surface,nodeCount,faceCount,transfer:'facet-fixed complex pressure / equal area-3 nodal distribution'}};
}

/** Transpose of the load operator: complex nodal displacement (m) -> per-face normal-displacement integral (m^3) with the same area-3 weights. */
export function faceNormalDisplacementIntegral(load,displacement){
  validateCurvedPressure(load);
  const {triangles}=load,{nodeCount,faceCount,normals,areasMm2}=facetGeometry(load),nodes=nodeCount*3;
  if(!displacement||!Array.isArray(displacement.real)||!Array.isArray(displacement.imag)||displacement.real.length!==nodes||displacement.imag.length!==nodes||!displacement.real.every(Number.isFinite)||!displacement.imag.every(Number.isFinite))throw Error('Curved pressure transfer requires a finite complex nodal displacement in metres');
  const volumeReal=[],volumeImag=[];
  for(let f=0;f<faceCount;f++){
    const weight=areasMm2[f]*1e-6/3,n=normals[f];let vr=0,vi=0;
    for(const i of triangles[f])for(let k=0;k<3;k++){vr+=displacement.real[i*3+k]*n[k];vi+=displacement.imag[i*3+k]*n[k];}
    volumeReal.push(weight*vr);volumeImag.push(weight*vi);
  }
  return {volumeReal,volumeImag,totalVolumeReal:volumeReal.reduce((s,v)=>s+v,0),totalVolumeImag:volumeImag.reduce((s,v)=>s+v,0),unit:'m^3'};
}

/** Conjugate virtual work: Sigma conj(u).f must equal -Sigma p*conj(integral u.n dA), both in J. */
export function virtualWorkIdentity(load,displacement){
  const forces=pressureNodalForces(load),volume=faceNormalDisplacementIntegral(load,displacement),pressure=load.pressure;
  let urf=0,uif=0;
  for(let i=0;i<forces.forceReal.length;i++){urf+=displacement.real[i]*forces.forceReal[i]+displacement.imag[i]*forces.forceImag[i];uif+=displacement.real[i]*forces.forceImag[i]-displacement.imag[i]*forces.forceReal[i];}
  let prf=0,pif=0;
  for(let f=0;f<volume.volumeReal.length;f++){const pr=pressure[f].real,pi=pressure[f].imag,ir=volume.volumeReal[f],ii=volume.volumeImag[f];prf-=pr*ir+pi*ii;pif-=pi*ir-pr*ii;}
  const absoluteErrorJ=Math.hypot(urf-prf,uif-pif),scale=Math.hypot(prf,pif);
  return {nodalWork:{real:urf,imag:uif},pressureWork:{real:prf,imag:pif},absoluteErrorJ,relativeErrorJ:scale>0?absoluteErrorJ/scale:absoluteErrorJ,unit:'J'};
}
