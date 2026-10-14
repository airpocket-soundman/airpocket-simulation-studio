const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const text=(v,max=2000)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
const id=v=>text(v,100)&&/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(v);
const record=(v,keys)=>plain(v)&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));
const fail=()=>{throw Error('Invalid publication milestone');};
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const timestamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v));
const revision=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
function refs(value,taskIds,{empty=false}={}){if(!Array.isArray(value)||value.length>(taskIds.size||1)||(!empty&&!value.length)||new Set(value).size!==value.length||value.some(v=>!id(v)||!taskIds.has(v)))fail();return value;}
function evidence(value){
 if(!record(value,['verified','result','checkedAt','candidateRevision','manifestRevision','runUrl','releaseTag','artifacts'])||value.verified!==true||value.result!=='passed'||!timestamp(value.checkedAt)||!revision(value.candidateRevision)||value.manifestRevision!==value.candidateRevision||!https(value.runUrl)||!/\/actions\/runs\/\d+\/?$/.test(new URL(value.runUrl).pathname)||!text(value.releaseTag,100)||!Array.isArray(value.artifacts)||!value.artifacts.length||value.artifacts.length>20||new Set(value.artifacts).size!==value.artifacts.length||value.artifacts.some(v=>!text(v,1000)))fail();
 return value;
}
/** Validate evidence declarations and candidate identity, not remote run results.
 * A release-task flag alone never completes a publication gate. */
export function validatePublicationMilestone(value,taskIds){
 if(value===undefined)return;
 if(!record(value,['schemaVersion','id','revisedAt','status','scope','taskStatusDoesNotCloseGate','gates','futureTaskIds','supportOnlyTaskIds','notes'])||value.schemaVersion!==1||!id(value.id)||!['pending','complete'].includes(value.status)||!text(value.scope,4000)||value.taskStatusDoesNotCloseGate!==true||typeof value.revisedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.revisedAt)||!Number.isFinite(Date.parse(value.revisedAt)))fail();
 // JSON size is bounded before traversal of referenced task sets.
 let size;try{size=new TextEncoder().encode(JSON.stringify(value)).length;}catch{fail();}if(size>65536)fail();
 if(!Array.isArray(value.gates)||value.gates.length!==6||!Array.isArray(value.notes)||value.notes.length>20||value.notes.some(v=>!text(v,2000)))fail();
 const names=new Set(),used=new Set(),completed=[];
 value.gates.forEach((gate,index)=>{
  if(!record(gate,['id','order','status','taskIds','acceptance','observations','evidence'])||!id(gate.id)||names.has(gate.id)||gate.order!==index||!['pending','complete'].includes(gate.status)||!text(gate.acceptance,4000))fail();names.add(gate.id);
  for(const ref of refs(gate.taskIds,taskIds))used.add(ref);
  if(gate.observations!==undefined){if(!Array.isArray(gate.observations)||gate.observations.length>20)fail();for(const o of gate.observations)if(!record(o,['kind','url','detail'])||!id(o.kind)||!text(o.detail,2000)||o.url!==undefined&&(!text(o.url,2000)||!https(o.url)))fail();}
  if(gate.status==='complete')completed.push(evidence(gate.evidence));else if(gate.evidence!==undefined)fail();
 });
 const future=refs(value.futureTaskIds,taskIds,{empty:true}),support=refs(value.supportOnlyTaskIds,taskIds,{empty:true});
 if(future.some(v=>used.has(v)||support.includes(v))||support.some(v=>used.has(v)))fail();
 if(completed.some(v=>v.candidateRevision!==completed[0].candidateRevision||v.releaseTag!==completed[0].releaseTag))fail();
 if(value.status==='complete'&&completed.length!==6)fail();
 // All gates may be verified while final publication approval remains pending.
}
