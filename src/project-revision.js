const plain=value=>value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);

// Stable JSON makes revisions independent of object property insertion order.
/** `memo` (optional Map) lets one caller reuse canonical strings of the top three nesting levels within one synchronous
 * inspection, so the same large objects are not serialised repeatedly. Output is identical with or without it. */
export function canonicalJson(value,seen=new Set(),memo) {
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(typeof value!=='object'||(!Array.isArray(value)&&!plain(value)))throw new TypeError('Project operations require JSON data.');
  if(seen.has(value))throw new TypeError('Cyclic JSON data is not supported.');
  seen.add(value);
  let result;
  if(Array.isArray(value)) {
    if(Reflect.ownKeys(value).length!==value.length+1)throw new TypeError('Sparse, decorated or accessor arrays are not supported.');
    // One descriptor read per element; plain finite-number arrays (the bulk of saved results) serialise natively.
    let numbers=true;
    for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,i);if(!d||!d.enumerable||!('value' in d))throw new TypeError('Sparse, decorated or accessor arrays are not supported.');if(numbers&&(typeof d.value!=='number'||!Number.isFinite(d.value)))numbers=false;}
    result=numbers?JSON.stringify(value):'['+value.map(item=>canonicalJson(item,seen,memo)).join(',')+']';
  } else {
    // Every own key must be an enumerable string data property, so the key list equals Object.keys(value).
    const keys=Reflect.ownKeys(value);
    for(const key of keys){if(typeof key!=='string')throw new TypeError('Only plain JSON properties are supported.');const d=Object.getOwnPropertyDescriptor(value,key);if(!d.enumerable||!('value' in d))throw new TypeError('Only plain JSON properties are supported.');}
    result='{'+keys.sort().map(key=>JSON.stringify(key)+':'+canonicalJson(value[key],seen,memo)).join(',')+'}';
  }
  seen.delete(value);if(memo&&seen.size<3)memo.set(value,result);return result;
}

export async function getProjectRevision(project,memo) {
  return hashCanonicalJson(canonicalJson(project,new Set(),memo));
}

/** SHA-256 revision of an already canonical JSON string. */
export async function hashCanonicalJson(canonical) {
  const bytes=new TextEncoder().encode(canonical);
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return 'sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
