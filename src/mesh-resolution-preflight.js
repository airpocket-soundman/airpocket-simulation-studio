// Post-mesh preflight helpers (pure, read-only): acoustic elements-per-wavelength and
// connected-component anchoring for structural/thermal meshes. Results are folded into the
// existing mesh-boundary preflight result as additive fields; nothing here runs a mesher or solver.

/** Elements-per-wavelength levels (linear tetrahedra, by maximum edge length h; wavelength = c/f).
 * wavelength / h >= WARN: no diagnostic. REFUSE <= wavelength / h < WARN: warning ACOUSTIC_MESH_UNDERRESOLVED.
 * wavelength / h < REFUSE: error ACOUSTIC_MESH_WAVELENGTH_UNRESOLVED (the wave cannot be represented; allowed:false).
 * 6 is a common rule of thumb for linear elements, not a certified accuracy bound. */
export const ELEMENTS_PER_WAVELENGTH_WARN=6;
export const ELEMENTS_PER_WAVELENGTH_REFUSE=2;

const finitePositive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const validTets=(mesh)=>Array.isArray(mesh?.tetrahedra)&&mesh.tetrahedra.length>0&&(Array.isArray(mesh.nodes)||ArrayBuffer.isView(mesh.nodes))&&mesh.nodes.length%3===0&&mesh.tetrahedra.every(t=>Array.isArray(t)&&t.length===4&&t.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.nodes.length/3));

/** Connected solid components from tetrahedron connectivity (sorted node lists). Returns null for unusable meshes. */
export function meshConnectedComponents(mesh){
 if(!validTets(mesh))return null;
 const n=mesh.nodes.length/3,parent=Array.from({length:n},(_,i)=>i),root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},used=new Set();
 for(const t of mesh.tetrahedra)for(const i of t){used.add(i);parent[root(i)]=root(t[0]);}
 const map=new Map();for(const i of [...used].sort((a,b)=>a-b)){const r=root(i);if(!map.has(r))map.set(r,[]);map.get(r).push(i);}
 return [...map.values()];
}

const notChecked=(status,reason,extra={})=>({status,reason,...extra});

/** Acoustic resolution: highest solved frequency (study.frequency, or sweepEnd for a sweep) and sound speed
 * against the mesh's maximum tetrahedron edge. Transient acoustics has no single solved frequency, so it is
 * reported as `unknown` (warning only) rather than guessed. */
export function analyzeAcousticResolution({project,mesh}={}){
 const study=project?.study??{};
 if(study.kind!=='acoustic')return {report:notChecked('not-applicable','Elements-per-wavelength applies to acoustic studies only'),diagnostics:[]};
 const unavailable=reason=>({report:notChecked('unknown',reason),diagnostics:[{code:'ACOUSTIC_RESOLUTION_CHECK_UNAVAILABLE',severity:'warning',stage:'mesh-resolution',target:'/study',message:reason,evidence:{},suggestions:['Inspect element size against the shortest wavelength manually'],requiresUserIntent:false}]});
 if(study.acousticTransient===true)return unavailable('Transient acoustics has no single solved frequency; elements per wavelength was not checked');
 const sweep=study.sweep===true,frequencyHz=sweep?study.sweepEnd:study.frequency,soundSpeed=study.soundSpeed;
 if(!finitePositive(frequencyHz)||!finitePositive(soundSpeed))return unavailable('Solved frequency or sound speed is missing or not positive; elements per wavelength was not checked');
 if(!validTets(mesh))return unavailable('Retained mesh has no usable tetrahedra; elements per wavelength was not checked');
 let maxEdgeMm=0;for(const t of mesh.tetrahedra)for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)maxEdgeMm=Math.max(maxEdgeMm,Math.hypot(...[0,1,2].map(k=>mesh.nodes[t[a]*3+k]-mesh.nodes[t[b]*3+k])));
 if(!(maxEdgeMm>0))return unavailable('Mesh maximum edge length is zero; elements per wavelength was not checked');
 const wavelengthMm=soundSpeed/frequencyHz*1000,elementsPerWavelength=wavelengthMm/maxEdgeMm;
 const level=elementsPerWavelength<ELEMENTS_PER_WAVELENGTH_REFUSE?'refuse':elementsPerWavelength<ELEMENTS_PER_WAVELENGTH_WARN?'warn':'ok';
 const evidence={frequencyHz,soundSpeedMps:soundSpeed,wavelengthMm,maxEdgeMm,elementsPerWavelength,warnBelow:ELEMENTS_PER_WAVELENGTH_WARN,refuseBelow:ELEMENTS_PER_WAVELENGTH_REFUSE,highestFrequencyOf:sweep?'sweep':'single-frequency'};
 const diagnostics=[];
 if(level==='refuse')diagnostics.push({code:'ACOUSTIC_MESH_WAVELENGTH_UNRESOLVED',severity:'error',stage:'mesh-resolution',target:'/study',message:`Only ${elementsPerWavelength.toFixed(2)} elements per wavelength (below ${ELEMENTS_PER_WAVELENGTH_REFUSE}); the wave cannot be represented by this mesh`,evidence,suggestions:['Refine the mesh or lower the solved frequency; do not report results from this mesh'],requiresUserIntent:true});
 else if(level==='warn')diagnostics.push({code:'ACOUSTIC_MESH_UNDERRESOLVED',severity:'warning',stage:'mesh-resolution',target:'/study',message:`${elementsPerWavelength.toFixed(2)} elements per wavelength is below the ${ELEMENTS_PER_WAVELENGTH_WARN} rule of thumb for linear elements; results may be inaccurate`,evidence,suggestions:['Refine the mesh and compare results, or treat the output as exploratory'],requiresUserIntent:false});
 return {report:{status:'checked',level,...evidence},diagnostics};
}

/** Connected-component anchoring. A component is anchored when it carries at least one transferred support:
 * structural = fixed/displacement node; steady thermal = temperature, convection or radiation node.
 * Transient thermal is not singular without an anchor (adiabatic bodies are valid), so it is reported
 * `not-applicable`. Thermal contact may couple components, so with contacts an unanchored component is a
 * warning, otherwise an error. The structural rigid-body rank check remains the authority on free modes. */
export function analyzeComponentAnchoring({project,mesh,boundary}={}){
 const study=project?.study??{},kind=study.kind??'structural';
 if(kind!=='structural'&&kind!=='thermal')return {report:notChecked('not-applicable','Component anchoring applies to structural and thermal studies only'),diagnostics:[]};
 if(kind==='structural'&&study.modalAnalysis===true)return {report:notChecked('not-applicable','Component anchoring is not evaluated for modal studies'),diagnostics:[]};
 if(kind==='thermal'&&study.transient===true)return {report:notChecked('not-applicable','Transient thermal conduction is not singular without an anchor; component anchoring not evaluated'),diagnostics:[]};
 const unusable=reason=>({report:notChecked('unknown',reason),diagnostics:[{code:'COMPONENT_ANCHORING_CHECK_UNAVAILABLE',severity:'warning',stage:'mesh-components',target:'/job',message:reason,evidence:{},suggestions:['Re-run the mesh-only job and inspect the retained mesh'],requiresUserIntent:false}]});
 const groups=meshConnectedComponents(mesh);
 if(!groups)return unusable('Retained mesh has no usable tetrahedra; component anchoring was not checked');
 const anchorNodes=new Set();
 if(kind==='structural'){for(const node of boundary?.fixed??[])anchorNodes.add(node);for(const r of boundary?.displacements??[])anchorNodes.add(r.node);}
 else{for(const [node] of boundary?.temperatures??[])anchorNodes.add(node);for(const r of [...(boundary?.convection??[]),...(boundary?.radiation??[])])for(const node of r.nodes??[])anchorNodes.add(node);}
 const couplesComponents=kind==='thermal'&&(boundary?.contacts?.length??0)>0;
 const components=groups.map((group,index)=>({index,nodeCount:group.length,anchoredNodeCount:group.filter(node=>anchorNodes.has(node)).length}));
 const unanchored=components.filter(c=>c.anchoredNodeCount===0);
 const diagnostics=[];
 if(unanchored.length)diagnostics.push({code:'MESH_COMPONENT_UNANCHORED',severity:couplesComponents?'warning':'error',stage:'mesh-components',target:'/conditions',message:`${unanchored.length} of ${components.length} connected mesh component${components.length===1?'':'s'} ${kind==='structural'?'carry no fixed or displacement support':'carry no temperature, convection or radiation boundary'}${couplesComponents?' (thermal contact may couple them to an anchored component; not verified)':''}`,evidence:{kind,componentCount:components.length,unanchoredComponents:unanchored.slice(0,20).map(c=>({index:c.index,nodeCount:c.nodeCount})),thermalContactPresent:couplesComponents},suggestions:['Check whether each disconnected body is intended and add the physical constraint or boundary that is genuinely missing'],requiresUserIntent:true});
 return {report:{status:'checked',kind,componentCount:components.length,unanchoredComponentCount:unanchored.length,thermalContactPresent:couplesComponents,components:components.slice(0,50),componentsTruncated:components.length>50},diagnostics};
}
