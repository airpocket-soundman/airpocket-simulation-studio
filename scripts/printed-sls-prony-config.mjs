import {printedAbsolutePath} from './printed-identification-file-io.mjs';
const fail=()=>{throw Object.assign(Error('Invalid SLS roundtrip config'),{code:'PRINTED_SLS_PRONY_CONFIG_INVALID'});};
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(n=>Object.hasOwn(x,n));
/** Dedicated bounded JSON parser; decoded duplicate keys are rejected, including Unicode escape aliases. */
export function parseSlsPronyConfig(text){
 if(typeof text!=='string'||text.length>65536||Buffer.byteLength(text)>65536)fail();let at=0,count=0;
 const ws=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!'))at++;};
 function string(){const start=at++;for(;at<text.length;at++){if(text[at]==='"'){at++;let x;try{x=JSON.parse(text.slice(start,at));}catch{fail();}if(x.length>4096)fail();return x;}if(text[at]==='\\')at++;}fail();}
 function value(depth){if(depth>8||++count>1024)fail();ws();const c=text[at];if(c==='"')return string();if(c==='{'||c==='['){const object=c==='{',x=object?Object.create(null):[],seen=new Set();at++;ws();if(text[at]===(object?'}':']')){at++;return x;}for(;;){ws();if(object){if(text[at]!=='"')fail();const k=string();if(seen.has(k)||seen.size>=32)fail();seen.add(k);ws();if(text[at++]!==':')fail();x[k]=value(depth+1);}else{if(x.length>=8)fail();x.push(value(depth+1));}ws();if(text[at]===(object?'}':']')){at++;return x;}if(text[at++]!==',')fail();}}const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!m)fail();at+=m[0].length;const v=JSON.parse(m[0]);if(typeof v==='number'&&!Number.isFinite(v))fail();return v;}
 const c=value(0);ws();if(at!==text.length||!exact(c,['schemaVersion','training','validation','options','specimenPairs','bulkModulusPa','rampDurationSeconds','workerMilliseconds'])||c.schemaVersion!==1)fail();
 for(const name of ['training','validation']){const s=c[name];if(!exact(s,['path','expectedSHA256'])||typeof s.expectedSHA256!=='string'||!/^[a-f0-9]{64}$/.test(s.expectedSHA256))fail();s.path=printedAbsolutePath(s.path);}
 if(!exact(c.options,['model','maxStrain','minPoints','maxRelativeStandardError','holdStrainTolerance'])||c.options.model!=='sls-relaxation'||!Array.isArray(c.specimenPairs)||!c.specimenPairs.length||c.specimenPairs.some(p=>!exact(p,['trainingSpecimenId','validationSpecimenId'])||Object.values(p).some(v=>typeof v!=='string'||!v.trim()||v!==v.trim()||v.length>200)))fail();
 for(const [name,v]of Object.entries(c.options))if(name!=='model'&&(typeof v!=='number'||!Number.isFinite(v)||v<=0))fail();if(!Number.isInteger(c.options.minPoints)||c.options.minPoints<3||c.options.minPoints>10000)fail();
 for(const n of ['bulkModulusPa','rampDurationSeconds'])if(typeof c[n]!=='number'||!Number.isFinite(c[n])||c[n]<=0)fail();
 if(c.bulkModulusPa<1||c.bulkModulusPa>1e12||c.rampDurationSeconds>1e9)fail();
 if(!Number.isSafeInteger(c.workerMilliseconds)||c.workerMilliseconds<1||c.workerMilliseconds>30000)fail();return c;
}
