// Match the browser's serialized input before committing, so the returned
// revision describes the next inspect call without hashing after mutation.
export function normalizeBrowserBuiltinProject(project,initialStudy){
 const next=structuredClone(project);
 next.study={...structuredClone(initialStudy),...next.study,gravityEnabled:false};
 for(const key of ['temperatureSource','vibrationSource','plasticLoadFractions'])delete next.study[key];
 next.meshSettings={refinements:[]};
 next.meshes=next.meshes.map(mesh=>({...mesh,positions:mesh.positions.map(Math.fround),kind:mesh.kind??'cad'}));
 return next;
}
