export const TET10_JOB_LIMITS=Object.freeze({parentElements:512,nodes:4096,maxIterations:20000,tolerance:1e-10});
export function tet10Error(message,code='TET10_JOB_UNSUPPORTED'){return Object.assign(Error(message),{code});}
export function rejectNativeTet10View(mesh,result){if(result?.kind==='elastic-tet10'||mesh?.elementOrder===2)throw tet10Error('Native Tet10 results are saved-file artifacts only; case/view/point/compare are not implemented.','TET10_NATIVE_RESULT_UNSUPPORTED');}
/** The first job profile deliberately supports one affine box and its complete axis-aligned faces only. */
export function validateTet10JobProfile(project,options,operation,target='node'){
 if(options.elementOrder===undefined||options.elementOrder===1)return;
 const bad=message=>{throw tet10Error(message);};
 if(options.elementOrder!==2||target!=='node'||operation!=='elastic'||options.method!=='pcg-strict'||options.adaptive!==false)bad('Tet10 requires node saved-file elastic / elementOrder2 / pcg-strict / adaptive false');
 const s=project.study??{},p=project.materialProperties??{},source=project.sourceModel;
 if(s.kind!=='structural'||s.gravityEnabled!==false||s.modalAnalysis||s.thermalStress||s.temperatureSource||s.temperature||s.plasticLoadFractions||s.materialTemperature!==undefined||p.orthotropic||p.plasticity||p.hyperelastic||p.dependence||p.temperatureDependence||p.printedEquivalent||options.fractureAssessment!==undefined||options.fatigueAssessment!==undefined)bad('Tet10 job supports static isotropic elasticity without gravity, thermal/dependent material or assessments');
 if(!Number.isFinite(p.youngModulus)||p.youngModulus<=0||!Number.isFinite(p.poissonRatio)||p.poissonRatio<=-1||p.poissonRatio>=.49)bad('Tet10 requires finite isotropic elastic constants');
 if(source?.kind!=='box'||!Array.isArray(source.bounds)||source.bounds.length!==6||!source.bounds.every(Number.isFinite)||!source.bounds.slice(3).every(v=>v>0)||project.meshes?.length!==1)bad('Tet10 job currently requires one explicit box');
 const tolerance=1e-6*Math.max(1,...source.bounds.slice(3));if(source.bounds.slice(3).some((v,k)=>v<=100*tolerance||!Number.isFinite(v+source.bounds[k])))bad('Tet10 box dimensions are outside the finite face-selection profile');
 if(!project.conditions?.length||!project.conditions.some(c=>c.type==='fixed')||!project.conditions.some(c=>c.type==='force')||project.conditions.some(c=>!['fixed','force'].includes(c.type)||['planarRegion','cylindricalRegion','sphericalRegion'].some(k=>c[k]!==undefined)))bad('Tet10 requires complete box-face fixed and total-force conditions only');
 return project.conditions.map(c=>tet10BoxFace(project,c));
}
export function tet10BoxFace(project,condition){
 const bounds=project.sourceModel.bounds,extent=bounds.slice(3),tol=1e-6*Math.max(1,...extent),positions=project.meshes[0].positions;
 const triangles=condition.regions?.flatMap(r=>r.mesh===0?r.triangles:[]);if(!Array.isArray(triangles)||triangles.length!==2||condition.regions.some(r=>r.mesh!==0))throw tet10Error('Tet10 conditions must select the two triangles of one complete box face');
 const corners=triangles.map(t=>[0,1,2].map(i=>[0,1,2].map(k=>{const x=positions[9*t+3*i+k];if(Math.abs(x-bounds[k])<=tol)return 0;if(Math.abs(x-bounds[k]-extent[k])<=tol)return 1;throw tet10Error('Tet10 selected display vertices must be box corners');})));
 const flat=corners.flat(),axis=[0,1,2].find(k=>flat.every(v=>v[k]===flat[0][k]));if(axis===undefined)throw tet10Error('Tet10 selected triangles must lie on one box face');
 const keys=corners.map(rows=>rows.map(v=>v.join(','))),unique=new Set(keys.flat()),common=keys[0].filter(k=>keys[1].includes(k)),across=[0,1,2].filter(k=>k!==axis);
 if(unique.size!==4||new Set(keys[0]).size!==3||new Set(keys[1]).size!==3||common.length!==2||across.some(k=>common[0].split(',')[k]===common[1].split(',')[k]))throw tet10Error('Tet10 selected triangles must cover the complete rectangle without overlap');
 return{axis,positionMm:bounds[axis]+flat[0][axis]*extent[axis],toleranceMm:tol,areaMm2:extent[across[0]]*extent[across[1]]};
}
