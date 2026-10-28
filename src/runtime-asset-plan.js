// P2 first step: which WASM assets a worker run needs, decided before any fetch.
// Mirrors the conditional loads in analysis.worker.js; tests guard the two against drift.
const ASSETS=Object.freeze({
 gmsh:Object.freeze({role:'gmsh',module:'gmsh/gmsh.mjs',wasm:'gmsh/gmsh-core.wasm'}),
 kernel:Object.freeze({role:'kernel',module:null,wasm:'fem-kernel.wasm'}),
 mfem:Object.freeze({role:'mfem',module:'mfem/mfem.mjs',wasm:'mfem/mfem.wasm'}),
});
export const KERNEL_METHODS=Object.freeze(['wasm-pcg','webgpu-pcg','mfem-wasm']);
export const RUNTIME_ASSET_ROLES=Object.freeze(Object.keys(ASSETS));
/** Ordered asset list for one worker request; operation is 'mesh' or a solve. */
export function planRuntimeAssets({operation='solve',method}={}){
 if(typeof operation!=='string'||!operation)throw TypeError('Invalid operation');
 if(method!==undefined&&typeof method!=='string')throw TypeError('Invalid method');
 const roles=['gmsh'];
 if(method==='mfem-wasm')roles.push('mfem');
 if(KERNEL_METHODS.includes(method))roles.push('kernel');
 return Object.freeze(roles.map(role=>ASSETS[role]));
}
/** Paths (relative to the app base) that a plan fetches, in order. */
export const planPaths=plan=>plan.flatMap(asset=>[asset.module,asset.wasm].filter(Boolean));
