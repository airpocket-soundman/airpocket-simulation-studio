import pkg from '../package.json' with {type:'json'};
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
// Bump the format if CAD construction or deterministic face-tag ordering changes.
export async function sourceFingerprint(source){
 const text='cad-identity-v1 / gmsh-wasm '+pkg.dependencies['@loumalouomega/gmsh-wasm']+' / '+JSON.stringify(canonical(source));
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
