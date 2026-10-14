const plain=value=>value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);

// Stable JSON makes revisions independent of object property insertion order.
export function canonicalJson(value,seen=new Set()) {
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(typeof value!=='object'||(!Array.isArray(value)&&!plain(value)))throw new TypeError('Project operations require JSON data.');
  if(seen.has(value))throw new TypeError('Cyclic JSON data is not supported.');
  seen.add(value);
  let result;
  if(Array.isArray(value)) {
    if(Reflect.ownKeys(value).length!==value.length+1||Array.from({length:value.length},(_,i)=>Object.getOwnPropertyDescriptor(value,String(i))).some(d=>!d||!d.enumerable||!('value' in d)))throw new TypeError('Sparse, decorated or accessor arrays are not supported.');
    result='['+value.map(item=>canonicalJson(item,seen)).join(',')+']';
  } else {
    if(Reflect.ownKeys(value).some(key=>typeof key!=='string'||!Object.getOwnPropertyDescriptor(value,key).enumerable||!('value' in Object.getOwnPropertyDescriptor(value,key))))throw new TypeError('Only plain JSON properties are supported.');
    result='{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(value[key],seen)).join(',')+'}';
  }
  seen.delete(value);return result;
}

export async function getProjectRevision(project) {
  const bytes=new TextEncoder().encode(canonicalJson(project));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return 'sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

