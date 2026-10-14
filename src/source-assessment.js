const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
/** Assessment lineage records the source calculation's declared input status.
 * It does not independently verify the solver, source truth or physical accuracy. */
export function validateSourceAssessment(value){
 const keys=['schemaVersion','mode','provisional','completePreflight','remainingChecks'];
 if(!plain(value)||Reflect.ownKeys(value).some(key=>typeof key!=='string'||!keys.includes(key)||!Object.getOwnPropertyDescriptor(value,key).enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))||keys.some(key=>!Object.hasOwn(value,key)))throw Error('Invalid source assessment metadata');
 if(value.schemaVersion!==1||!['legacy','quantitative','exploratory'].includes(value.mode)||typeof value.provisional!=='boolean'||value.completePreflight!==false||!Array.isArray(value.remainingChecks)||value.remainingChecks.length===0||Reflect.ownKeys(value.remainingChecks).some(key=>key!=='length'&&(typeof key!=='string'||!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.remainingChecks.length||!Object.getOwnPropertyDescriptor(value.remainingChecks,key).enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(value.remainingChecks,key),'value')))||Object.keys(value.remainingChecks).length!==value.remainingChecks.length||!Array.from(value.remainingChecks).every(item=>typeof item==='string'&&item.trim().length>0))throw Error('Invalid source assessment metadata');
 return value;
}
export function copySourceAssessment(output){
 const value=output?.analysisAssessment??output?.result?.analysisAssessment;
 return value===undefined?{}:{sourceAssessment:structuredClone(validateSourceAssessment(value))};
}
