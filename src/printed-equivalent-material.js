// Metadata/validity for one explicit printed equivalent material; no calibration is inferred.
import {validateOrthotropic} from './orthotropic-material.js';
const finite=v=>typeof v==='number'&&Number.isFinite(v),object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=message=>{throw Object.assign(Error(message),{code:'PRINTED_EQUIVALENT_INVALID'});};
const keys=(v,allowed)=>{if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k))||allowed.some(k=>!Object.hasOwn(v,k)))fail('Invalid printed equivalent record fields');};
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=1000;
const positive=v=>finite(v)&&v>0&&v<=1e6;
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(finite);
function range(v,min=-Infinity,max=Infinity){return Array.isArray(v)&&v.length===2&&v.every(finite)&&v[0]>=min&&v[1]<=max&&v[0]<=v[1];}
function dataset(d){keys(d,['id','revision','specimenIds']);if(!text(d.id)||!text(d.revision)||!Array.isArray(d.specimenIds)||!d.specimenIds.length||d.specimenIds.length>100||!d.specimenIds.every(text)||new Set(d.specimenIds).size!==d.specimenIds.length)fail('Invalid printed measured dataset reference');}
export function validatePrintedEquivalentMaterial(properties){
 const r=properties?.printedEquivalent;
 if(properties?.printedStructure!==undefined)fail(r===undefined?'Explicit wall/infill structural models are not implemented':'Equivalent and explicit wall/infill stiffness cannot be combined');
 if(r===undefined)return;
 keys(r,['schemaVersion','model','id','units','specimen','material','printer','print','constants','basis','validity']);
 if(r.schemaVersion!==1||r.model!=='equivalent-orthotropic'||!text(r.id))fail('Unsupported printed equivalent model');
 keys(r.units,['length','modulus','direction','temperature','strainRate','fraction']);
 for(const [k,v] of Object.entries({length:'mm',modulus:'Pa',direction:'1',temperature:'degC',strainRate:'1/s',fraction:'1'}))if(r.units[k]!==v)fail('Printed equivalent units must be explicit: '+k+'='+v);
 keys(r.specimen,['id','dimensionsMm']);if(!text(r.specimen.id)||!vector(r.specimen.dimensionsMm)||!r.specimen.dimensionsMm.every(positive))fail('Invalid printed specimen dimensions');
 keys(r.material,['name','batch']);keys(r.printer,['model']);if(!text(r.material.name)||!text(r.material.batch)||!text(r.printer.model))fail('Printed material/batch/printer identity required');
 keys(r.print,['buildDirection','layerHeightMm','wallCount','wallThicknessMm','infillFraction','infillPattern']);
 const p=r.print;if(!vector(p.buildDirection)||Math.abs(Math.hypot(...p.buildDirection)-1)>1e-8||!positive(p.layerHeightMm)||!Number.isInteger(p.wallCount)||p.wallCount<0||p.wallCount>100||p.wallThicknessMm!==null&&!positive(p.wallThicknessMm)||!finite(p.infillFraction)||p.infillFraction<0||p.infillFraction>1||!text(p.infillPattern))fail('Invalid printed process dimensions; unknown wall thickness must be explicit null');
 validateOrthotropic(properties.orthotropic);if(!properties.orthotropic)fail('Printed equivalent material requires orthotropic constants');
 keys(r.constants,['youngModuliPa','poissonRatios','shearModuliPa','axes']);
 for(const k of Object.keys(r.constants))if(JSON.stringify(r.constants[k])!==JSON.stringify(properties.orthotropic[k]))fail('Printed equivalent constants/axes differ from registered orthotropic material');
 keys(r.basis,['kind','source','identification','independentValidation']);const b=r.basis;
 if(!['theoretical','assumed','identified'].includes(b.kind)||!text(b.source))fail('Printed material basis must distinguish theory, assumption and identification');
 if(b.kind==='identified'){dataset(b.identification);if(!b.identification.specimenIds.includes(r.specimen.id))fail('Identification must reference its printed specimen');}else if(b.identification!==null)fail('Theory/assumption must not claim measured identification');
 if(b.independentValidation!==null){dataset(b.independentValidation);if(b.kind!=='identified'||b.independentValidation.id===b.identification.id||b.independentValidation.specimenIds.some(id=>b.identification.specimenIds.includes(id)))fail('Independent validation must use separate dataset and specimens');}
 keys(r.validity,['temperatureRangeC','strainRateRangePerSecond','layerHeightRangeMm','infillFractionRange']);const v=r.validity;
 if(!range(v.temperatureRangeC,-273.15)||!range(v.strainRateRangePerSecond,0)||!range(v.layerHeightRangeMm,Number.MIN_VALUE,1e6)||!range(v.infillFractionRange,0,1))fail('Invalid printed equivalent applicability range');
 for(const [value,bounds] of [[p.layerHeightMm,v.layerHeightRangeMm],[p.infillFraction,v.infillFractionRange]])if(value<bounds[0]||value>bounds[1])fail('Printed process lies outside its registered applicability range');
 return r;
}
export function requirePrintedEquivalentEvaluation(properties,temperature){
 const r=validatePrintedEquivalentMaterial(properties);if(!r)return;
 const temperatures=Array.isArray(temperature)?temperature:[temperature],range=r.validity.temperatureRangeC;
 if(!temperatures.length||temperatures.some(t=>!finite(t)||t<range[0]||t>range[1]))fail('Temperature lies outside printed equivalent applicability');
 if(r.validity.strainRateRangePerSecond[0]>0)fail('Static structure has zero strain rate outside printed equivalent applicability');
}
export function requirePrintedEquivalentStudy(project){
 const r=validatePrintedEquivalentMaterial(project.materialProperties);if(!r)return;
 if(project.study?.kind!=='structural'||project.study.modalAnalysis||project.study.thermalStress||!finite(project.study.materialTemperature))fail('Printed equivalent material requires static structure and explicit materialTemperature');
 requirePrintedEquivalentEvaluation(project.materialProperties,project.study.materialTemperature);
}
