/** Honest per-physics preflight coverage. `implemented` lists checks the shared
 * preflight performs before meshing; `remaining` lists checks that do not exist
 * yet; `postMeshImplemented` lists checks that exist only in the post-mesh mesh-boundary preflight. completePreflight is true only when `remaining` is empty, which no physics
 * satisfies today because convergence, mesh dependence and physical accuracy remain unverified. */
const postMesh=['Boundary-region transfer and constraint rank/rigid-body modes after meshing','Source applicability, convergence, mesh dependence and physical accuracy'];
const common=['required-input presence','finite/positive range per input','provenance for every required pointer','fixed unit table mismatch','unit magnitude warning','runtime-option override conflict'];
const table={
 'static-isotropic-linear-structure':{
  implemented:['Project/material schema and original solid source','Execution options and target capability diagnostics','Fixed input unit mismatch and structural unit-magnitude warnings','Explicit Young modulus and Poisson ratio; density and acceleration when gravity is used','Structural boundary type discipline and presence of a selected fixed/displacement support','Required-pointer provenance in quantitative/exploratory modes; legacy does not require provenance','Unresolved CAD-condition rejection'],
  postMeshImplemented:['Finite Tet4 nodes/connectivity/volume/gradients and available quality data (no quality cutoff)','Selected-boundary transfer, mapped area and projection-distance reports','Connected-component rigid-body constraint rank for nodal fixed/displacement supports (diagnostic only; does not change allowed)'],
  remaining:['Material/source applicability, solver convergence, mesh dependence and physical accuracy','General mesh-quality acceptance thresholds','Spring/elastic-support constraint rank and post-mesh inspection for modal, orthotropic, nonlinear, thermal-stress or temperature-dependent structural combinations'],
 },
 'thermal-conduction':{implemented:[...common,'boundary type discipline','steady anchor boundary','transient material/time/steps/initial temperature','region validity'],remaining:[...postMesh],postMeshImplemented:['Finite Tet4 nodes/connectivity/volume/gradients and available quality data (no quality cutoff)','Connected-component anchoring after meshing (steady thermal: temperature/convection/radiation node per component including transferred thermal contact connectivity)']},
 'acoustic-wave':{implemented:[...common,'harmonic medium and reference pressure','sweep range/count/receiver','transient duration/pulse/step/damping/receiver','source or impedance boundary','branch compatibility','exterior radiation/directivity geometry'],remaining:[...postMesh],postMeshImplemented:['Finite Tet4 nodes/connectivity/volume/gradients and available quality data (no quality cutoff)','Wavelength-per-element resolution after meshing (harmonic/sweep including loss and target size; transient three-sigma pulse bandwidth; solver one-sixth-wavelength limit)']},
};
export function physicsCoverage(contract){
 const entry=table[contract];
 if(!entry)return {contract:contract??null,implemented:[],remaining:postMesh,completePreflight:false};
 return {contract,implemented:[...entry.implemented],postMeshImplemented:[...entry.postMeshImplemented],remaining:[...entry.remaining],completePreflight:entry.remaining.length===0};
}
