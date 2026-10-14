import {inspectIntermediate} from './intermediate-results.js';

async function sha256(json){const bytes=new TextEncoder().encode(json);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}

// Retain serialized observations, never live Worker arrays. The byte budget is
// shared by all jobs in this browser client; release returns their allocation.
export function createBrowserIntermediateStore({maxBytes=64_000_000,hash=sha256}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<0)throw Error('Invalid intermediate byte limit');
 const jobs=new Map();let usedBytes=0;
 const size=json=>new TextEncoder().encode(json).byteLength;
 const integrity=()=>Object.assign(Error('Intermediate artifact integrity check failed'),{code:'INTERMEDIATE_INTEGRITY_FAILED'});
 return {
  async capture(jobId,inputRevision,event,isActive=()=>true){
   if(!isActive()||(!event.mesh&&!event.field))return;
   let job=jobs.get(jobId);if(!job){job={inputRevision,records:new Map(),sequence:0,mesh:undefined,limited:false};jobs.set(jobId,job);}
   if(job.inputRevision!==inputRevision)throw integrity();
   const meshEvent=!!event.mesh;if(meshEvent)job.mesh=undefined;
   if(event.field&&!job.mesh)return {unavailable:true,reason:'No retained mesh for this intermediate field'};
   const value={schemaVersion:1,jobId,inputRevision,provisional:true,...(meshEvent?{mesh:event.mesh}:{field:event.field,meshArtifactId:job.mesh.artifactId,meshSha256:job.mesh.sha256})};
   // Validate observations before exposing them; malformed telemetry fails only
   // observation, not a calculation whose final result can still be valid.
   const mesh=meshEvent?event.mesh:JSON.parse(job.records.get(job.mesh.artifactId).json).mesh;
   inspectIntermediate(value,mesh);
   const json=JSON.stringify(value),bytes=size(json);
   if(usedBytes+bytes>maxBytes){job.limited=true;return {limited:true,limitBytes:maxBytes};}
   const digest=await hash(json);
   if(!isActive()||jobs.get(jobId)!==job)return;
   if(usedBytes+bytes>maxBytes){job.limited=true;return {limited:true,limitBytes:maxBytes};}
   const artifactId=String(++job.sequence).padStart(4,'0'),ref={artifactId,jobId,inputRevision,bytes,sha256:digest,kind:meshEvent?'mesh':event.field.kind,provisional:true,storage:'browser-memory'};
   job.records.set(artifactId,{json,ref});usedBytes+=bytes;if(meshEvent)job.mesh=ref;
   return {artifact:structuredClone(ref)};
  },
  async read(jobId,artifactId,options={}){
   const job=jobs.get(jobId),record=job?.records.get(artifactId);if(!record)throw Error('Unknown intermediate artifact for this browser job');
   const read=async r=>{if(size(r.json)!==r.ref.bytes||await hash(r.json)!==r.ref.sha256)throw integrity();const value=JSON.parse(r.json);if(value.schemaVersion!==1||value.jobId!==jobId||value.inputRevision!==job.inputRevision||value.provisional!==true)throw integrity();return value;};
   const snapshot=await read(record);let mesh=snapshot.mesh;
   if(!mesh){const meshRecord=job.records.get(snapshot.meshArtifactId);if(!meshRecord||meshRecord.ref.sha256!==snapshot.meshSha256)throw integrity();mesh=(await read(meshRecord)).mesh;}
   if(jobs.get(jobId)!==job)throw Error('Browser artifact was released during retrieval');
   return {schemaVersion:1,jobId,inputRevision:job.inputRevision,artifact:structuredClone(record.ref),...inspectIntermediate(snapshot,mesh,options)};
  },
  summary(jobId){const job=jobs.get(jobId);return {retainedArtifacts:job?.records.size||0,retainedBytes:job?[...job.records.values()].reduce((n,r)=>n+r.ref.bytes,0):0,storageLimited:job?.limited||false,sharedBytes:usedBytes,maxBytes};},
  release(jobId){const job=jobs.get(jobId);if(job)for(const r of job.records.values())usedBytes-=r.ref.bytes;jobs.delete(jobId);},
  clear(){jobs.clear();usedBytes=0;}
 };
}
