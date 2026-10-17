/** Honest per-physics preflight coverage. `implemented` lists checks the shared
 * preflight performs before meshing; `remaining` lists checks that do not exist
 * yet; `postMeshImplemented` lists checks that exist only in the post-mesh mesh-boundary preflight. completePreflight is true only when `remaining` is empty, which no physics
 * satisfies today because mesh quality and post-mesh boundary checks are unimplemented. */
const postMesh=['Mesh quality and element validity after generation','Boundary-region transfer and constraint rank/rigid-body modes after meshing','Source applicability, convergence, mesh dependence and physical accuracy'];
const common=['required-input presence','finite/positive range per input','provenance for every required pointer','fixed unit table mismatch','unit magnitude warning','runtime-option override conflict'];
const table={
 'thermal-conduction':{implemented:[...common,'boundary type discipline','steady anchor boundary','transient material/time/steps/initial temperature','region validity'],remaining:[...postMesh],postMeshImplemented:['Connected-component anchoring after meshing (steady thermal: temperature/convection/radiation node per component including transferred thermal contact connectivity)']},
 'acoustic-wave':{implemented:[...common,'harmonic medium and reference pressure','sweep range/count/receiver','transient duration/pulse/step/damping/receiver','source or impedance boundary','branch compatibility','exterior radiation/directivity geometry'],remaining:[...postMesh],postMeshImplemented:['Wavelength-per-element resolution after meshing (harmonic/sweep including loss and target size; transient three-sigma pulse bandwidth; solver one-sixth-wavelength limit)']},
};
export function physicsCoverage(contract){
 const entry=table[contract];
 if(!entry)return {contract:contract??null,implemented:[],remaining:postMesh,completePreflight:false};
 return {contract,implemented:[...entry.implemented],postMeshImplemented:[...entry.postMeshImplemented],remaining:[...entry.remaining],completePreflight:entry.remaining.length===0};
}
