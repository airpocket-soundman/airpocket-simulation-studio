// Positional semantic arguments are JSON values, not strings. Explicit shallow
// array element unions preserve the common index/vector/matrix shapes for tool
// clients without recursive $ref. Deeper JSON remains accepted; the semantic
// methods still own positional, geometry, provenance and physical validation.
function jsonValue(arrayDepth){
 return {anyOf:[{type:'number'},{type:'string'},{type:'boolean'},{type:'null'},{type:'object',additionalProperties:true},{type:'array',items:arrayDepth>0?jsonValue(arrayDepth-1):{description:'Any deeper finite JSON value; detailed nested validation is performed by the semantic method.'}}]};
}
export const semanticOperationArgumentsSchema={type:'array',items:jsonValue(2),description:'Typed positional JSON arguments of the selected semantic method. Numbers, strings, booleans, null, records and nested arrays are represented explicitly; exact method arity and physical/nested data remain runtime-validated.'};

// Method-specific discovery shared by saved stdio and live preview/edit.
export const selectedMeshRefinementSchema={description:'Append at most 80 selected-triangle centroid regions per call, retaining existing refinements and selection. Total stored refinements must not exceed 160. Empty selection is rejected. Same helper as GUI; no meshing or convergence proof.',type:'object',additionalProperties:false,required:['size','radius','baseSize'],properties:{size:{type:'number',exclusiveMinimum:0,description:'Local target size in mm; 15–100% of baseSize (runtime cross-field check).'},radius:{type:'number',exclusiveMinimum:0,description:'Influence radius in mm.'},baseSize:{type:'number',exclusiveMinimum:0,description:'Explicit global mesh target size in mm; does not change job options.'}}};
export function withMeshRefinementOperationSchema(operation){return {...operation,allOf:[...(operation.allOf??[]),{if:{properties:{method:{const:'addSelectedMeshRefinements'}},required:['method']},then:{properties:{args:{type:'array',minItems:1,maxItems:1,prefixItems:[selectedMeshRefinementSchema],items:false}}}}]};}
