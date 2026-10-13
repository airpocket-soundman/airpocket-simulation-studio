import {validateFluidDomain} from './fluid-domain.js';

export function validateStokesStudy(study){
 if(!study||study.kind!=='creepingFlow'||!Number.isFinite(study.dynamicViscosity)||study.dynamicViscosity<=0||!Number.isFinite(study.fluidDensity)||study.fluidDensity<=0||!Array.isArray(study.freeStreamVelocity)||study.freeStreamVelocity.length!==3||!study.freeStreamVelocity.every(Number.isFinite)||!Number.isFinite(Math.hypot(...study.freeStreamVelocity))||Math.hypot(...study.freeStreamVelocity)<=0)throw Error('Stokes study requires positive viscosity and density and a finite nonzero free-stream velocity');
 if(study.referenceLengthMm!==undefined&&(!Number.isFinite(study.referenceLengthMm)||study.referenceLengthMm<=0))throw Error('Stokes reference length must be positive in mm');
 if(study.referenceLengthMm!==undefined){const re=study.fluidDensity*Math.hypot(...study.freeStreamVelocity)*study.referenceLengthMm*.001/study.dynamicViscosity;if(!Number.isFinite(re)||re>.1+1e-12)throw Error('Stokes prototype requires Reynolds number <= 0.1');}
}

export function stokesBoundary(mesh,source,study){
 validateStokesStudy(study);validateFluidDomain(source);
 if(source.mode==='internal'||!Array.isArray(source.enclosure))throw Error('Stokes requires an external fluid domain with a box enclosure');
 const nodes=mesh?.nodes,n=nodes?.length/3;
 if(!Array.isArray(nodes)||!Number.isInteger(n)||n<4||n>2000||!nodes.every(Number.isFinite)||!Array.isArray(mesh.surface)||!mesh.surface.length||mesh.surface.length>32000)throw Error('Invalid Stokes boundary mesh');
 const box=source.enclosure,tolerance=Math.max(1e-8,Math.max(...box.slice(3))*1e-7),outerNodes=new Set(),innerNodes=new Set(),outerTags=new Set(),bodyTags=new Set();
 for(const face of mesh.surface){
  if(!Array.isArray(face.nodes)||face.nodes.length!==3||new Set(face.nodes).size!==3||!face.nodes.every(i=>Number.isInteger(i)&&i>=0&&i<n)||!Number.isInteger(face.faceTag))throw Error('Invalid Stokes boundary face');
  const outer=[0,1,2,3,4,5].some(plane=>{const axis=plane%3,value=box[axis]+(plane>=3?box[axis+3]:0);return face.nodes.every(node=>Math.abs(nodes[node*3+axis]-value)<=tolerance);});
  const selection=outer?outerNodes:innerNodes,tags=outer?outerTags:bodyTags;tags.add(face.faceTag);face.nodes.forEach(node=>selection.add(node));
 }
 if(!outerNodes.size||!innerNodes.size||[...innerNodes].some(node=>outerNodes.has(node))||[...bodyTags].some(tag=>outerTags.has(tag)))throw Error('Stokes requires distinct outer box and inner no-slip boundaries');
 if(nodes.some((value,i)=>value<box[i%3]-tolerance||value>box[i%3]+box[i%3+3]+tolerance))throw Error('Stokes fluid mesh lies outside its enclosure');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const node of innerNodes)for(let k=0;k<3;k++){min[k]=Math.min(min[k],nodes[node*3+k]);max[k]=Math.max(max[k],nodes[node*3+k]);}
 let inferred=Math.max(...max.map((value,k)=>value-min[k]));const solid=source.solid;
 let knownBounds;
 if(solid.kind==='sphere')knownBounds=[...solid.center.map(v=>v-solid.radius),2*solid.radius,2*solid.radius,2*solid.radius];
 if(solid.kind==='box')knownBounds=solid.bounds;
 if(solid.kind==='cylinder')knownBounds=[-12,-30,-12,24,60,24];
 if(solid.kind==='tube')knownBounds=[...solid.center.map((v,k)=>v-(k===solid.axis?solid.length/2:solid.outerRadius)),...[0,1,2].map(k=>k===solid.axis?solid.length:2*solid.outerRadius)];
 if(solid.kind==='boxes'){const lo=[0,1,2].map(k=>Math.min(...solid.boxes.map(b=>b[k]))),hi=[0,1,2].map(k=>Math.max(...solid.boxes.map(b=>b[k]+b[k+3])));knownBounds=[...lo,...hi.map((v,k)=>v-lo[k])];}
 const onBox=(point,bounds)=>point.every((v,k)=>v>=bounds[k]-tolerance&&v<=bounds[k]+bounds[k+3]+tolerance)&&point.some((v,k)=>Math.abs(v-bounds[k])<=tolerance||Math.abs(v-bounds[k]-bounds[k+3])<=tolerance);
 const onCylinder=(point,center,axis,length,outerRadius,innerRadius=0)=>{const q=point.map((v,k)=>v-center[k]),axial=Math.abs(q[axis]),radial=Math.hypot(...q.filter((_,k)=>k!==axis));return axial<=length/2+tolerance&&radial<=outerRadius+tolerance&&radial>=innerRadius-tolerance&&(Math.abs(radial-outerRadius)<=tolerance||innerRadius>0&&Math.abs(radial-innerRadius)<=tolerance||Math.abs(axial-length/2)<=tolerance);};
 for(const node of innerNodes){
  const point=nodes.slice(3*node,3*node+3);
  const valid=solid.kind==='sphere'?Math.abs(Math.hypot(...point.map((v,k)=>v-solid.center[k]))-solid.radius)<=tolerance:solid.kind==='box'?onBox(point,solid.bounds):solid.kind==='boxes'?solid.boxes.some(bounds=>onBox(point,bounds)):solid.kind==='cylinder'?onCylinder(point,[0,0,0],1,60,12):solid.kind==='tube'?onCylinder(point,solid.center,solid.axis,solid.length,solid.outerRadius,solid.innerRadius):true;
  if(!valid)throw Error('Stokes inner boundary does not match the original solid geometry');
 }
 if(solid.kind==='sphere')inferred=Math.max(inferred,2*solid.radius);
 if(solid.kind==='cylinder')inferred=Math.max(inferred,60);
 if(solid.kind==='box')inferred=Math.max(inferred,...solid.bounds.slice(3));
 if(solid.kind==='tube')inferred=Math.max(inferred,solid.length,2*solid.outerRadius);
 if(solid.kind==='boxes')for(let k=0;k<3;k++)inferred=Math.max(inferred,Math.max(...solid.boxes.map(b=>b[k]+b[k+3]))-Math.min(...solid.boxes.map(b=>b[k])));
 if(mesh.solidBoundsMm!==undefined){
  const bounds=mesh.solidBoundsMm;
  if(!Array.isArray(bounds)||bounds.length!==6||!bounds.every(Number.isFinite)||bounds.slice(3).some(v=>v<=0)||min.some((v,k)=>v<bounds[k]-tolerance||max[k]>bounds[k]+bounds[k+3]+tolerance))throw Error('Stokes body nodes do not match its CAD bounding box');
  if(knownBounds&&bounds.some((v,k)=>Math.abs(v-knownBounds[k])>tolerance))throw Error('Stokes CAD bounding box does not match the original solid dimensions');
  const cadLength=Math.max(...bounds.slice(3));
  if(cadLength<inferred-tolerance)throw Error('Stokes CAD bounding box understates the body dimensions');
  inferred=cadLength;
 }else if(solid.kind==='step')throw Error('Stokes STEP flow requires the original CAD solid bounding box');
 if(!(inferred>0)||!Number.isFinite(inferred))throw Error('Stokes body has an invalid characteristic length');
 const referenceLengthMm=study.referenceLengthMm??inferred;
 if(referenceLengthMm<inferred-tolerance)throw Error('Stokes reference length cannot be smaller than the body bounding-box span');
 validateStokesStudy({...study,referenceLengthMm});
 const velocity=new Map();for(const node of outerNodes)velocity.set(node,study.freeStreamVelocity.slice());for(const node of innerNodes)velocity.set(node,[0,0,0]);
 return {velocity,bodyFaceTags:[...bodyTags].sort((a,b)=>a-b),pressureGauge:{node:outerNodes.values().next().value,valuePa:0},referenceLengthMm};
}
