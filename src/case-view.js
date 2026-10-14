import {validateOrthotropicResult} from './orthotropic-result.js';
import {validatePlasticResult} from './plasticity-result.js';
import {requireResolvedCadConditions} from './cad-update-state.js';
import {validateStokesResult} from './stokes-result.js';
import {validateFractureResult} from './fracture-core.js';
import {validateFatigueResult} from './fatigue-result.js';
import {validateStlMesh} from './stl-source.js';
import {validateCylindricalMesh} from './cylindrical-cad.js';
import {validatePlanarMesh} from './planar-region.js';
import {validateInternalMesh} from './internal-fluid.js';
import {validateComputeMetadata} from './cases.js';
import {inspectMesh} from './mesh-core.js';
export function prepareCaseView(saved){
 const output=structuredClone(saved?.output),mesh=output?.mesh,r=output?.result;
 requireResolvedCadConditions(output?.input??{});
 validateStokesResult(mesh,r,output?.input,output?.calculation);
 validateStlMesh(mesh,output?.input,output?.calculation);
 validateFatigueResult(mesh,r,output?.input,output?.calculation);
 validateFractureResult(mesh,r,output?.input,output?.calculation);
 validatePlanarMesh(mesh,output.input);validateCylindricalMesh(mesh,output.input);validatePlasticResult(mesh,r,output.input);validateOrthotropicResult(mesh,r,output?.input,output?.calculation);validateComputeMetadata(r);validateInternalMesh(mesh,output?.input?.sourceModel);
 if(!mesh||!r||!Array.isArray(mesh.tetrahedra)||mesh.tetrahedra.length>30000||!Array.isArray(mesh.nodes)||mesh.nodes.length>360000)throw Error('Invalid saved result mesh');
 mesh.summary=inspectMesh(mesh);const n=mesh.summary.nodeCount,e=mesh.summary.elementCount;
 if(!Array.isArray(mesh.surface)||!mesh.surface.length||mesh.surface.length>120000||mesh.surface.some(f=>!Array.isArray(f.nodes)||f.nodes.length!==3||new Set(f.nodes).size!==3||!f.nodes.every(i=>Number.isInteger(i)&&i>=0&&i<n)))throw Error('Invalid saved result surface');
 const vector=(v,length)=>Array.isArray(v)&&v.length===length&&v.every(Number.isFinite);
 const matrix=(v,rows,cols)=>Array.isArray(v)&&v.length===rows&&v.every(row=>vector(row,cols));
 const valid=r.kind==='stokes'?vector(r.velocity,n*3)&&vector(r.speed,n)&&vector(r.pressure,n)&&matrix(r.stresses,e,6)&&vector(r.divergence,e):r.kind==='modal'?r.modes.every(m=>vector(m.displacement,n*3)&&vector(m.magnitudes,n)&&m.magnitudes.every(v=>v>=0)&&Math.abs(Math.max(...m.magnitudes)-1)<1e-8):r.kind==='elastic'?vector(r.displacement,n*3)&&vector(r.magnitudes,n)&&vector(r.vonMises,e):r.kind==='thermal'?vector(r.temperature,n)&&matrix(r.flux,e,3):r.kind==='channelFlow'?vector(r.velocity,n*3)&&vector(r.speed,n)&&vector(r.pressure,n):r.kind==='acousticTransient'?vector(r.pressure,n)&&r.snapshots.every(f=>vector(f.pressure,n)):r.kind==='acoustic'?['real','imag','magnitude','spl','phase'].every(k=>vector(r[k],n))&&Number.isFinite(r.referencePressurePa)&&r.referencePressurePa>0:false;
 if(!valid)throw Error('Invalid saved result fields');
 return output;
}
