// Positional semantic arguments are JSON values, not strings. Explicit shallow
// array element unions preserve the common index/vector/matrix shapes for tool
// clients without recursive $ref. Deeper JSON remains accepted; the semantic
// methods still own positional, geometry, provenance and physical validation.
function jsonValue(arrayDepth){
 return {anyOf:[{type:'number'},{type:'string'},{type:'boolean'},{type:'null'},{type:'object',additionalProperties:true},{type:'array',items:arrayDepth>0?jsonValue(arrayDepth-1):{description:'Any deeper finite JSON value; detailed nested validation is performed by the semantic method.'}}]};
}
export const semanticOperationArgumentsSchema={type:'array',items:jsonValue(2),description:'Typed positional JSON arguments of the selected semantic method. Numbers, strings, booleans, null, records and nested arrays are represented explicitly; exact method arity and physical/nested data remain runtime-validated.'};
