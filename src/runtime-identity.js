const HASH=/^sha256:[a-f0-9]{64}$/;
const fail=()=>{throw new TypeError('Invalid runtime identity');};
const plain=value=>value!==null&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function record(value,keys){if(!plain(value)||Reflect.ownKeys(value).length!==keys.length||Reflect.ownKeys(value).some(key=>typeof key!=='string'||!keys.includes(key)||!Object.getOwnPropertyDescriptor(value,key).enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value')))fail();}
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
/** An absent identity is a legacy record, never evidence of the current build. */
export function validateRuntimeIdentity(value,{allowUndefined=true}={}){
 if(value===undefined&&allowUndefined)return undefined;
 record(value,['schemaVersion','target','isolation','build','engine','assets']);
 if(value.schemaVersion!==1||!['browser','node'].includes(value.target)||!(value.target==='browser'?value.isolation==='web-worker':['worker-thread','process'].includes(value.isolation)))fail();
 const build=value.build;
 if(!plain(build))fail();
 const status=Object.getOwnPropertyDescriptor(build,'status');if(!status||!Object.hasOwn(status,'value'))fail();
 if(status.value==='unavailable')record(build,['status']);
 else{
  record(build,['status','version','revision','dirty','sourceFingerprint']);
  if(build.status!=='available'||!text(build.version,100)||typeof build.revision!=='string'||!/^[a-f0-9]{40}$/.test(build.revision)||typeof build.dirty!=='boolean'||typeof build.sourceFingerprint!=='string'||!HASH.test(build.sourceFingerprint))fail();
 }
 record(value.engine,['requestedMethod','actualEngine']);
 if(value.engine.requestedMethod!==null&&!text(value.engine.requestedMethod,100)||value.engine.actualEngine!==null&&!text(value.engine.actualEngine,200))fail();
 const assets=value.assets;
 if(!Array.isArray(assets)||assets.length>16||Reflect.ownKeys(assets).length!==assets.length+1||Array.from({length:assets.length},(_,i)=>Object.getOwnPropertyDescriptor(assets,String(i))).some(d=>!d||!d.enumerable||!Object.hasOwn(d,'value')))fail();
 for(const asset of assets){record(asset,['role','bytes','sha256','status']);if(!['kernel','gmsh','mfem'].includes(asset.role)||!Number.isSafeInteger(asset.bytes)||asset.bytes<1||asset.bytes>100000000||typeof asset.sha256!=='string'||!HASH.test(asset.sha256)||!['observed','declared'].includes(asset.status))fail();}
 if(new TextEncoder().encode(JSON.stringify(value)).length>16384)fail();
 return JSON.parse(JSON.stringify(value));
}
export function createRuntimeIdentity({target,isolation,build={status:'unavailable'},requestedMethod=null,actualEngine=null,assets=[]}={}){
 return validateRuntimeIdentity({schemaVersion:1,target,isolation,build,engine:{requestedMethod,actualEngine},assets},{allowUndefined:false});
}
