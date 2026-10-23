// Explicit session provider only; no transport, authentication or tool delegation.
export const AGENT_CHAT_LIMITS=Object.freeze({promptBytes:16384,responseBytes:65536,historyBytes:131072,messages:16});
const bytes=text=>new TextEncoder().encode(text).length;
const phases=new Set(['idle','starting','initialized','creating','ready','prompting','cancelling','closing','closed','failed','authentication-required']);
export function createAgentChatState({onChange=()=>{}}={}){
 const retired=new WeakSet();
 let provider=null,epoch=0,pending=false,cancelling=false,destroyed=false,history=[],failure=null,completion=null;
 const phase=()=>{if(destroyed)return 'closed';if(cancelling)return 'cancelling';if(pending)return 'prompting';if(!provider)return 'unavailable';if(retired.has(provider))return 'closed';try{const state=provider.describe().state;return phases.has(state)?state:'unavailable';}catch{return 'failed';}};
 const snapshot=()=>({phase:phase(),canSend:!destroyed&&!pending&&!cancelling&&phase()==='ready',canStop:pending&&!cancelling,failureCode:failure,messages:history.map(m=>({...m})),productionTransport:false});
 const emit=()=>{const state=snapshot();try{onChange(state);}catch{/* observer cannot own session lifecycle */}return state;};
 const append=(role,text)=>{history.push({role,text});while(history.length>AGENT_CHAT_LIMITS.messages||history.reduce((sum,m)=>sum+bytes(m.text),0)>AGENT_CHAT_LIMITS.historyBytes)history.shift();};
 function setProvider(next){
  if(destroyed)throw Error('CHAT_CLOSED');
  if(next!==null&&(!next||!['describe','prompt','cancel'].every(k=>typeof next[k]==='function')))throw Error('CHAT_PROVIDER_INVALID');
  if(next!==null&&retired.has(next))throw Error('CHAT_PROVIDER_RETIRED');
  const old=provider,wasPending=pending;epoch++;provider=next;pending=false;cancelling=false;completion=null;history=[];failure=null;
  if(wasPending){retired.add(old);try{Promise.resolve(old.cancel()).catch(()=>{});}catch{/* obsolete provider */}}return emit();
 }
 async function send(text){
  if(!snapshot().canSend)throw Error('CHAT_NOT_READY');
  if(typeof text!=='string'||!text.trim()||bytes(text)>AGENT_CHAT_LIMITS.promptBytes)throw Error('CHAT_PROMPT_INVALID');
  const generation=++epoch,current=provider;pending=true;failure=null;append('user',text);emit();
  try{
   if(generation!==epoch||destroyed)return false;
   completion=Promise.resolve(current.prompt(text));const result=await completion;
   if(generation!==epoch||destroyed)return false;
   if(!result||typeof result.text!=='string'||bytes(result.text)>AGENT_CHAT_LIMITS.responseBytes||typeof result.cancelled!=='boolean')throw Error('CHAT_RESPONSE_INVALID');
   if(!result.cancelled)append('assistant',result.text);return true;
  }catch{if(generation===epoch&&!destroyed){failure='CHAT_PROMPT_FAILED';return false;}return false;}
  finally{if(generation===epoch&&!destroyed){pending=false;completion=null;emit();}}
 }
 async function stop(){
  if(!pending||cancelling||destroyed)return false;
  const generation=++epoch,current=provider,settled=completion;retired.add(current);pending=false;cancelling=true;failure=null;emit();
  try{await current.cancel();await settled?.catch(()=>{});return true;}catch{if(generation===epoch&&!destroyed)failure='CHAT_CANCEL_FAILED';return false;}
  finally{if(generation===epoch&&!destroyed){cancelling=false;completion=null;emit();}}
 }
 function destroy(){if(destroyed)return;const old=provider,active=pending||cancelling;epoch++;destroyed=true;pending=false;cancelling=false;completion=null;provider=null;history=[];if(active){retired.add(old);try{Promise.resolve(old.cancel()).catch(()=>{});}catch{/* obsolete provider */}}emit();}
 return {snapshot,setProvider,send,stop,refresh:emit,destroy};
}
