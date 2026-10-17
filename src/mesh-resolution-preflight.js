import {ACOUSTIC_ELEMENTS_PER_WAVELENGTH,acousticResolutionLimits,acousticEdgeResolved} from './acoustic-resolution-contract.js';

// Solver-aligned six-element limit; both exports remain available for existing callers.
export const ELEMENTS_PER_WAVELENGTH_WARN=ACOUSTIC_ELEMENTS_PER_WAVELENGTH;
export const ELEMENTS_PER_WAVELENGTH_REFUSE=ACOUSTIC_ELEMENTS_PER_WAVELENGTH;

const finitePositive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const validTets=(mesh)=>Array.isArray(mesh?.tetrahedra)&&mesh.tetrahedra.length>0&&(Array.isArray(mesh.nodes)||ArrayBuffer.isView(mesh.nodes))&&mesh.nodes.length%3===0&&mesh.tetrahedra.every(t=>Array.isArray(t)&&t.length===4&&t.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.nodes.length/3));

/** Connected solid components from tetrahedron connectivity (sorted node lists). Returns null for unusable meshes. */
export function meshConnectedComponents(mesh,links=[]){
 if(!validTets(mesh))return null;
 const n=mesh.nodes.length/3,parent=Array.from({length:n},(_,i)=>i),root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},used=new Set();
 for(const t of [...mesh.tetrahedra,...links])for(const i of t){used.add(i);parent[root(i)]=root(t[0]);}
 const map=new Map();for(const i of [...used].sort((a,b)=>a-b)){const r=root(i);if(!map.has(r))map.set(r,[]);map.get(r).push(i);}
 return [...map.values()];
}

const notChecked=(status,reason,extra={})=>({status,reason,...extra});

/** Acoustic resolution: highest solved frequency (study.frequency, or sweepEnd for a sweep) and sound speed
 * against the mesh's maximum tetrahedron edge. Transient acoustics uses the solver's
 * three-sigma pulse bandwidth; harmonic wavelength includes the solver loss factor. */
export function analyzeAcousticResolution({project,mesh}={}){
 const study=project?.study??{};
 if(study.kind!=='acoustic')return {report:notChecked('not-applicable','Elements-per-wavelength applies to acoustic studies only'),diagnostics:[]};
 const unavailable=reason=>({report:notChecked('unknown',reason),diagnostics:[{code:'ACOUSTIC_RESOLUTION_CHECK_UNAVAILABLE',severity:'warning',stage:'mesh-resolution',target:'/study',message:reason,evidence:{},suggestions:['Inspect element size against the shortest wavelength manually'],requiresUserIntent:false}]});
 const transient=study.acousticTransient===true,sweep=!transient&&study.sweep===true,frequencyHz=sweep?study.sweepEnd:study.frequency,soundSpeed=study.soundSpeed;
 if(!finitePositive(frequencyHz)||!finitePositive(soundSpeed))return unavailable('Solved frequency or sound speed is missing or not positive; elements per wavelength was not checked');
 if(!validTets(mesh))return unavailable('Retained mesh has no usable tetrahedra; elements per wavelength was not checked');
 let maxEdgeMm=0;for(const t of mesh.tetrahedra)for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)maxEdgeMm=Math.max(maxEdgeMm,Math.hypot(...[0,1,2].map(k=>mesh.nodes[t[a]*3+k]-mesh.nodes[t[b]*3+k])));
 if(!(maxEdgeMm>0))return unavailable('Mesh maximum edge length is zero; elements per wavelength was not checked');
 let limits;try{limits=acousticResolutionLimits({frequency:frequencyHz,soundSpeed,lossFactor:study.lossFactor,transient,pulseWidth:study.pulseWidth});}catch{return unavailable('Acoustic wavelength inputs are invalid; resolution was not checked');}
 const {wavelengthMm}=limits,elementsPerWavelength=wavelengthMm/maxEdgeMm,targetSizeExceeded=!transient&&mesh.size>limits.maxTargetSizeMm;
 const level=!acousticEdgeResolved(maxEdgeMm,limits)||targetSizeExceeded?'refuse':'ok';
 const evidence={frequencyHz,soundSpeedMps:soundSpeed,wavelengthMm,maxEdgeMm,elementsPerWavelength,warnBelow:ELEMENTS_PER_WAVELENGTH_WARN,refuseBelow:ELEMENTS_PER_WAVELENGTH_REFUSE,highestFrequencyOf:transient?'three-sigma-pulse-bandwidth':sweep?'sweep':'single-frequency',...(transient?{bandwidthHz:limits.bandwidthHz,pulseWidthSeconds:study.pulseWidth??.0002}:{lossFactor:study.lossFactor??.01,targetSizeExceeded,maxTargetSizeMm:limits.maxTargetSizeMm}),reason:targetSizeExceeded?'solver-target-size-limit':'solver-six-elements-per-wavelength'};
 const diagnostics=[];
 if(level==='refuse')diagnostics.push({code:'ACOUSTIC_MESH_WAVELENGTH_UNRESOLVED',severity:'error',stage:'mesh-resolution',target:'/study',message:targetSizeExceeded?'Acoustic mesh target size exceeds the solver one-sixth-wavelength limit':`Acoustic maximum edge exceeds the solver one-sixth-wavelength limit (${elementsPerWavelength.toFixed(2)} elements per wavelength)`,evidence,suggestions:['Refine the mesh or lower the solved frequency; do not report results from this mesh'],requiresUserIntent:true});

 return {report:{status:'checked',level,...evidence},diagnostics};
}

/** Connected-component anchoring. A component is anchored when it carries at least one transferred support:
 * structural = fixed/displacement node; steady thermal = temperature, convection or radiation node.
 * Transient thermal is not singular without an anchor (adiabatic bodies are valid), so it is reported
 * `not-applicable`. Transferred thermal contact node groups join solid components before checking anchors. The structural rigid-body rank check remains the authority on free modes. */
export function analyzeComponentAnchoring({project,mesh,boundary}={}){
 const study=project?.study??{},kind=study.kind??'structural';
 if(kind!=='structural'&&kind!=='thermal')return {report:notChecked('not-applicable','Component anchoring applies to structural and thermal studies only'),diagnostics:[]};
 if(kind==='structural'&&study.modalAnalysis===true)return {report:notChecked('not-applicable','Component anchoring is not evaluated for modal studies'),diagnostics:[]};
 if(kind==='thermal'&&study.transient===true)return {report:notChecked('not-applicable','Transient thermal conduction is not singular without an anchor; component anchoring not evaluated'),diagnostics:[]};
 const unusable=reason=>({report:notChecked('unknown',reason),diagnostics:[{code:'COMPONENT_ANCHORING_CHECK_UNAVAILABLE',severity:'warning',stage:'mesh-components',target:'/job',message:reason,evidence:{},suggestions:['Re-run the mesh-only job and inspect the retained mesh'],requiresUserIntent:false}]});
 const contacts=kind==='thermal'?(boundary?.contacts??[]):[];
 if(contacts.some(c=>!Array.isArray(c?.ids)||c.ids.length!==6||new Set(c.ids).size!==6||!c.ids.every(i=>Number.isInteger(i)&&i>=0&&i<(mesh?.nodes?.length??0)/3)||!Array.isArray(c.k)||c.k.length!==36||!c.k.every(Number.isFinite)))return {report:notChecked('unknown','Transferred thermal contact is invalid'),diagnostics:[{code:'COMPONENT_ANCHORING_CONTACT_INVALID',severity:'error',stage:'mesh-components',target:'/conditions',message:'Transferred thermal contact cannot establish valid connectivity',evidence:{contactCount:contacts.length},suggestions:['Inspect the transferred thermal contact before solving'],requiresUserIntent:true}]};
 const groups=meshConnectedComponents(mesh,contacts.map(c=>c.ids));
 if(!groups)return unusable('Retained mesh has no usable tetrahedra; component anchoring was not checked');
 const anchorNodes=new Set();
 if(kind==='structural'){for(const node of boundary?.fixed??[])anchorNodes.add(node);for(const r of boundary?.displacements??[])anchorNodes.add(r.node);}
 else{for(const [node] of boundary?.temperatures??[])anchorNodes.add(node);for(const r of [...(boundary?.convection??[]),...(boundary?.radiation??[])])for(const node of r.nodes??[])anchorNodes.add(node);}
 const couplesComponents=kind==='thermal'&&(boundary?.contacts?.length??0)>0;
 const components=groups.map((group,index)=>({index,nodeCount:group.length,anchoredNodeCount:group.filter(node=>anchorNodes.has(node)).length}));
 const unanchored=components.filter(c=>c.anchoredNodeCount===0);
 const diagnostics=[];
 if(unanchored.length)diagnostics.push({code:'MESH_COMPONENT_UNANCHORED',severity:'error',stage:'mesh-components',target:'/conditions',message:`${unanchored.length} of ${components.length} connected mesh component${components.length===1?'':'s'} ${kind==='structural'?'carry no fixed or displacement support':'carry no temperature, convection or radiation boundary'}${couplesComponents?' after including transferred thermal contact connectivity':''}`,evidence:{kind,componentCount:components.length,unanchoredComponents:unanchored.slice(0,20).map(c=>({index:c.index,nodeCount:c.nodeCount})),thermalContactPresent:couplesComponents},suggestions:['Check whether each disconnected body is intended and add the physical constraint or boundary that is genuinely missing'],requiresUserIntent:true});
 return {report:{status:'checked',kind,componentCount:components.length,unanchoredComponentCount:unanchored.length,thermalContactPresent:couplesComponents,components:components.slice(0,50),componentsTruncated:components.length>50},diagnostics};
}
