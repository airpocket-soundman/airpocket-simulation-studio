// Discovery schemas mirror the two existing evidence setters. They do not
// confirm source truth, user intent, pointer applicability or snapshot freshness.
const nonblank={type:'string',pattern:'\\S'};
const object=(properties,required=[])=>({type:'object',properties,required});
const source=object({kind:{enum:['user-input','measured-document','cad','agent-proposal']},reference:{description:'Source reference; nonblank string required for measured-document and cad.'},revision:{description:'Source document/CAD revision; nonblank string required for measured-document and cad.'}},['kind']);
source.allOf=[{if:{properties:{kind:{enum:['measured-document','cad']}},required:['kind']},then:{required:['reference','revision'],properties:{reference:nonblank,revision:nonblank}}}];
export const inputProvenanceSchema=object({schemaVersion:{const:1},entries:{type:'array',items:object({
 pointer:{type:'string',pattern:'^/(?:[^~]|~[01])*$',description:'Non-root JSON Pointer into the saved input, escaping ~ as ~0 and / as ~1. Duplicate pointers and missing/current-value mismatches are runtime checks.'},
 value:{description:'Exact JSON snapshot at pointer; do not supply confidence or a replacement physical input.'},source,
 rationale:{...nonblank,description:'Why this declared value was selected.'},applicability:{...nonblank,description:'Conditions and limits under which the evidence applies.'},
 assumption:{anyOf:[{type:'null'},nonblank],description:'Null when no assumption is declared, otherwise a nonblank explicit assumption. Exploratory unconfirmed required inputs need an assumption.'},
 status:{enum:['confirmed','unconfirmed']},confirmation:object({by:{const:'user'},note:nonblank},['by','note'])
 },['pointer','value','source','rationale','applicability','assumption','status'])}},['schemaVersion','entries']);
export const analysisIntentSchema={...object({mode:{enum:['quantitative','exploratory']}},['mode']),additionalProperties:false};

/** Other semantic methods keep their existing positional JSON declaration.
 * Existing setters consume their first argument and ignore extra positional
 * arguments, so those trailing arguments deliberately remain accepted here. */
export function withEvidenceOperationSchemas(operation){
 return {...operation,allOf:[
  {if:{properties:{method:{const:'setInputProvenance'}},required:['method']},then:{properties:{args:{type:'array',minItems:1,prefixItems:[inputProvenanceSchema]}}}},
  {if:{properties:{method:{const:'setAnalysisIntent'}},required:['method']},then:{properties:{args:{type:'array',minItems:1,prefixItems:[analysisIntentSchema]}}}}
 ]};
}
