import {validateProgress} from './progress.js';

export const MAX_PUBLISHED_PROGRESS_BYTES=2_000_000;
const MAX_MANIFEST_BYTES=65536;
const error=(code,message)=>Object.assign(Error(message),{code});
async function readBytes(url,limit,fetcher,timeoutMs){
 const response=await fetcher(url.href,{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
 if(!response?.ok)throw error(response?.status===404?'PUBLISHED_PROGRESS_NOT_FOUND':'PUBLISHED_PROGRESS_HTTP','Published progress resource unavailable');
 const declared=response.headers?.get('content-length');if(declared!==null&&declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>limit)){try{await response.body?.cancel();}catch{}throw error('PUBLISHED_PROGRESS_SIZE','Published progress resource exceeds its byte limit');}
 if(!response.body||typeof response.body.getReader!=='function')throw error('PUBLISHED_PROGRESS_BODY','Published progress requires a bounded response stream');
 const reader=response.body.getReader(),chunks=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(!(value instanceof Uint8Array)||value.length>limit-total)throw error('PUBLISHED_PROGRESS_SIZE','Published progress resource exceeds its byte limit');chunks.push(value);total+=value.length;}}
 catch(cause){try{await reader.cancel();}catch{}throw cause;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
function json(bytes){try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw error('PUBLISHED_PROGRESS_JSON','Published progress resource is not valid UTF-8 JSON');}}
function manifestIdentity(value){
 const record=value?.files?.['progress.json'];
 if(!value||value.schema!==1||typeof value.version!=='string'||!/^\d+\.\d+\.\d+$/.test(value.version)||typeof value.revision!=='string'||!/^[a-f0-9]{40}$/.test(value.revision)||value.dirty!==false||!record||!Number.isSafeInteger(record.bytes)||record.bytes<1||record.bytes>MAX_PUBLISHED_PROGRESS_BYTES||typeof record.sha256!=='string'||!/^[a-f0-9]{64}$/.test(record.sha256))throw error('PUBLISHED_PROGRESS_MANIFEST','Published progress manifest has no clean valid revision and progress identity');
 return {version:value.version,revision:value.revision,bytes:record.bytes,sha256:record.sha256};
}
function progressForBoard(value){
 const p=validateProgress(value);
 if(!['version','date','description'].every(key=>typeof p.release[key]==='string')||!p.solvers.every(row=>Array.isArray(row)&&row.every(cell=>typeof cell==='string'))||p.tasks.some(task=>['acceptance','evidence','titleEn','detailEn','acceptanceEn','lastUpdate','lastUpdateEn'].some(key=>task[key]!==undefined&&typeof task[key]!=='string')||task.depends!==undefined&&!Array.isArray(task.depends)))throw error('PUBLISHED_PROGRESS_INVALID','Published progress presentation metadata is invalid');
 return p;
}
/** Verify only the progress asset's relationship to a stable clean publication
 * manifest. This does not certify other runtime assets or physical accuracy.
 * No state is adopted on failure, and no repository/main fallback is attempted. */
export async function fetchPublishedProgress({baseUrl,fetcher=fetch,timeoutMs=8000,nonce=Date.now(),subtle=globalThis.crypto?.subtle}={}){
 const base=new URL(baseUrl);if(!['http:','https:'].includes(base.protocol)||base.username||base.password||typeof fetcher!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>30000||!subtle||typeof subtle.digest!=='function')throw TypeError('Invalid published progress reader configuration');
 const url=(path,phase)=>{const value=new URL(path,base);value.searchParams.set('publication-check',String(nonce)+'-'+phase);return value;};
 const first=manifestIdentity(json(await readBytes(url('runtime-manifest.json','before'),MAX_MANIFEST_BYTES,fetcher,timeoutMs)));
 const progressUrl=url('progress.json','progress');progressUrl.searchParams.set('sha',first.sha256);
 const bytes=await readBytes(progressUrl,Math.min(MAX_PUBLISHED_PROGRESS_BYTES,first.bytes),fetcher,timeoutMs);
 if(bytes.length!==first.bytes)throw error('PUBLISHED_PROGRESS_INTEGRITY','Published progress byte length differs from its manifest');
 const digest=Array.from(new Uint8Array(await subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
 if(digest!==first.sha256)throw error('PUBLISHED_PROGRESS_INTEGRITY','Published progress checksum differs from its manifest');
 let progress;try{progress=progressForBoard(json(bytes));}catch(cause){if(cause.code)throw cause;throw error('PUBLISHED_PROGRESS_INVALID','Published progress schema is invalid');}
 const last=manifestIdentity(json(await readBytes(url('runtime-manifest.json','after'),MAX_MANIFEST_BYTES,fetcher,timeoutMs)));
 if(JSON.stringify(first)!==JSON.stringify(last))throw error('PUBLISHED_PROGRESS_CHANGED','Publication changed while progress was being verified');
 return {schemaVersion:1,verified:true,revision:first.revision,applicationVersion:first.version,progressBytes:first.bytes,progressSha256:first.sha256,progress:structuredClone(progress)};
}
