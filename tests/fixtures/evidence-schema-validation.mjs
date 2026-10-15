// Independent evaluation of the JSON Schema keywords used by these discovery
// declarations. This does not establish compatibility with any tool generator.
export function accepts(s,v){
 if(s.const!==undefined&&v!==s.const||s.enum&&!s.enum.includes(v))return false;
 const type=v===null?'null':Array.isArray(v)?'array':Number.isInteger(v)?'integer':typeof v;
 if(s.type&&!([s.type].flat().includes(type)||type==='integer'&&[s.type].flat().includes('number')))return false;
 if(s.anyOf&&!s.anyOf.some(x=>accepts(x,v))||s.allOf&&!s.allOf.every(x=>accepts(x,v)))return false;
 if(s.if&&accepts(s.if,v)&&s.then&&!accepts(s.then,v))return false;
 if(type==='string'&&s.pattern&&!new RegExp(s.pattern).test(v))return false;
 if(type==='array'){if(s.minItems!==undefined&&v.length<s.minItems||s.maxItems!==undefined&&v.length>s.maxItems)return false;if(s.prefixItems&&!s.prefixItems.every((x,i)=>i>=v.length||accepts(x,v[i])))return false;if(s.items&&v.slice(s.prefixItems?.length??0).some(x=>!accepts(s.items,x)))return false;}
 if(type==='object'){if(s.required?.some(key=>!Object.hasOwn(v,key)))return false;if(s.additionalProperties===false&&Object.keys(v).some(key=>!Object.hasOwn(s.properties??{},key)))return false;for(const [key,value]of Object.entries(v))if(s.properties?.[key]&&!accepts(s.properties[key],value))return false;}
 return true;
}
