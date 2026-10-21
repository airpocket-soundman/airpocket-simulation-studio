// Conservative curved-interface pressure transfer (discrete faceted integral only).
// Oriented triangles carry a face-fixed complex pressure; the fluid -> structure operator
// distributes -p*n * area/3 to each vertex, and its exact transpose turns nodal displacement
// back into a per-face normal-displacement integral with the same weights.
// Contract: nodes in mm, pressure in Pa as {real,imag}, displacement in m, force in N, work in J.
// NOT wired into any solver, worker, MCP or UI path, and NOT a smooth-surface accuracy claim.

const LENGTH_UNITS=['mm'],PRESSURE_UNITS=['Pa'],SURFACES=['open','closed'];

// Typed rejection for finite inputs whose intermediate or output value cannot be represented in a double.
// No clamping, NaN->0, pressure/displacement rescaling or tolerance loosening: the caller must reduce the input.
function numericLimit(what){const error=Error(`Curved pressure transfer rejects a result outside the finite numeric range (${what})`);error.code='CURVED_PRESSURE_NUMERIC_LIMIT';return error;}
const finiteValue=(value,what)=>{if(!Number.isFinite(value))throw numericLimit(what);return value;};

function facetGeometry(load){
  const {nodes,triangles}=load,normals=[],areasMm2=[],faces=new Set();
  for(const t of triangles){
    const key=[...t].sort((a,b)=>a-b).join(',');
    if(faces.has(key))throw Error('Curved pressure transfer rejects a duplicate face');faces.add(key);
    const [a,b,c]=t.map(i=>nodes.slice(3*i,3*i+3)),u=b.map((v,k)=>finiteValue(v-a[k],'coordinate difference')),w=c.map((v,k)=>finiteValue(v-a[k],'coordinate difference')),
      cross=[finiteValue(u[1]*w[2]-u[2]*w[1],'cross product'),finiteValue(u[2]*w[0]-u[0]*w[2],'cross product'),finiteValue(u[0]*w[1]-u[1]*w[0],'cross product')],
      length=Math.hypot(...cross);
    if(!(length>0))throw Error('Curved pressure transfer rejects a degenerate face');
    finiteValue(length,'edge length');
    normals.push(cross.map(v=>finiteValue(v/length,'unit normal')));areasMm2.push(finiteValue(length*.5,'face area'));
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
    const weight=finiteValue(areasMm2[f]*1e-6/3,'area weight'),n=normals[f],tr=finiteValue(-weight*pressure[f].real,'complex pressure force'),ti=finiteValue(-weight*pressure[f].imag,'complex pressure force');
    for(const i of triangles[f])for(let k=0;k<3;k++){
      forceReal[i*3+k]=finiteValue(forceReal[i*3+k]+finiteValue(tr*n[k],'nodal force'),'nodal force accumulation');
      forceImag[i*3+k]=finiteValue(forceImag[i*3+k]+finiteValue(ti*n[k],'nodal force'),'nodal force accumulation');
    }
  }
  const resultantReal=[0,0,0],resultantImag=[0,0,0],momentReal=[0,0,0],momentImag=[0,0,0];
  for(let i=0;i<nodeCount;i++){
    const r=nodes.slice(3*i,3*i+3).map(v=>finiteValue(v*1e-3,'position in metres')),fr=forceReal.slice(3*i,3*i+3),fi=forceImag.slice(3*i,3*i+3),
      mr=cross(r,fr).map(v=>finiteValue(v,'origin moment')),mi=cross(r,fi).map(v=>finiteValue(v,'origin moment'));
    for(let k=0;k<3;k++){resultantReal[k]=finiteValue(resultantReal[k]+fr[k],'resultant accumulation');resultantImag[k]=finiteValue(resultantImag[k]+fi[k],'resultant accumulation');momentReal[k]=finiteValue(momentReal[k]+mr[k],'moment accumulation');momentImag[k]=finiteValue(momentImag[k]+mi[k],'moment accumulation');}
  }
  let totalAreaMm2=0;for(const area of areasMm2)totalAreaMm2=finiteValue(totalAreaMm2+area,'total area accumulation');
  return {forceReal,forceImag,normals,areasMm2,totalAreaMm2,resultantReal,resultantImag,momentReal,momentImag,metadata:{lengthUnit:'mm',pressureUnit:'Pa',surface:load.surface,nodeCount,faceCount,transfer:'facet-fixed complex pressure / equal area-3 nodal distribution'}};
}

/** Transpose of the load operator: complex nodal displacement (m) -> per-face normal-displacement integral (m^3) with the same area-3 weights. */
export function faceNormalDisplacementIntegral(load,displacement){
  validateCurvedPressure(load);
  const {triangles}=load,{nodeCount,faceCount,normals,areasMm2}=facetGeometry(load),nodes=nodeCount*3;
  if(!displacement||!Array.isArray(displacement.real)||!Array.isArray(displacement.imag)||displacement.real.length!==nodes||displacement.imag.length!==nodes||!displacement.real.every(Number.isFinite)||!displacement.imag.every(Number.isFinite))throw Error('Curved pressure transfer requires a finite complex nodal displacement in metres');
  const volumeReal=[],volumeImag=[];
  for(let f=0;f<faceCount;f++){
    // Apply the shared area/3 weight to each contribution before summing so a finite final integral
    // (e.g. 1e308 m over a 50 mm^2 face -> 5e303 m^3) does not overflow in an intermediate sum.
    const weight=finiteValue(areasMm2[f]*1e-6/3,'area weight'),n=normals[f];let vr=0,vi=0;
    for(const i of triangles[f])for(let k=0;k<3;k++){
      vr=finiteValue(vr+finiteValue(finiteValue(weight*displacement.real[i*3+k],'weighted displacement')*n[k],'normal displacement'),'normal displacement accumulation');
      vi=finiteValue(vi+finiteValue(finiteValue(weight*displacement.imag[i*3+k],'weighted displacement')*n[k],'normal displacement'),'normal displacement accumulation');
    }
    volumeReal.push(vr);volumeImag.push(vi);
  }
  let totalVolumeReal=0,totalVolumeImag=0;
  for(let f=0;f<faceCount;f++){totalVolumeReal=finiteValue(totalVolumeReal+volumeReal[f],'total volume accumulation');totalVolumeImag=finiteValue(totalVolumeImag+volumeImag[f],'total volume accumulation');}
  return {volumeReal,volumeImag,totalVolumeReal,totalVolumeImag,unit:'m^3'};
}

/** Conjugate virtual work: Sigma conj(u).f must equal -Sigma p*conj(integral u.n dA), both in J. */
export function virtualWorkIdentity(load,displacement){
  const forces=pressureNodalForces(load),volume=faceNormalDisplacementIntegral(load,displacement),pressure=load.pressure;
  let urf=0,uif=0;
  for(let i=0;i<forces.forceReal.length;i++){
    urf=finiteValue(urf+finiteValue(displacement.real[i]*forces.forceReal[i],'nodal work')+finiteValue(displacement.imag[i]*forces.forceImag[i],'nodal work'),'nodal work accumulation');
    uif=finiteValue(uif+finiteValue(displacement.real[i]*forces.forceImag[i],'nodal work')-finiteValue(displacement.imag[i]*forces.forceReal[i],'nodal work'),'nodal work accumulation');
  }
  let prf=0,pif=0;
  for(let f=0;f<volume.volumeReal.length;f++){
    const pr=pressure[f].real,pi=pressure[f].imag,ir=volume.volumeReal[f],ii=volume.volumeImag[f];
    prf=finiteValue(prf-finiteValue(pr*ir,'pressure work')-finiteValue(pi*ii,'pressure work'),'pressure work accumulation');
    pif=finiteValue(pif-finiteValue(pi*ir,'pressure work')+finiteValue(pr*ii,'pressure work'),'pressure work accumulation');
  }
  const absoluteErrorJ=finiteValue(Math.hypot(urf-prf,uif-pif),'work identity error'),scale=finiteValue(Math.hypot(prf,pif),'work identity scale');
  return {nodalWork:{real:urf,imag:uif},pressureWork:{real:prf,imag:pif},absoluteErrorJ,relativeErrorJ:finiteValue(scale>0?absoluteErrorJ/scale:absoluteErrorJ,'work identity relative error'),unit:'J'};
}
