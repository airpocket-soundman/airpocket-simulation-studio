// ACP v1 bounded text-session client. No agent detection, authentication, filesystem,
// terminal, MCP delegation, browser transport or model selection is implemented.
import {isAbsolute} from 'node:path';
import {AcpClientProcess,ACP_SCHEMA_REFERENCE} from './acp-client-process.mjs';

export const ACP_SESSION_LIMITS=Object.freeze({promptBytes:16384,textBytes:65536,updates:128,recordBytes:65536,requestTimeoutMs:30000,cancelTimeoutMs:2000});
export const ACP_SESSION_REFERENCE=ACP_SCHEMA_REFERENCE;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const stops=new Set(['end_turn','max_tokens','max_turn_requests','refusal','cancelled']);
const updates=new Set(['user_message_chunk','agent_message_chunk','agent_thought_chunk','tool_call','tool_call_update','plan','available_commands_update','current_mode_update','config_option_update','session_info_update','usage_update']);
const error=code=>Object.assign(new Error(code),{code});
const timeout=(value,fallback)=>{const n=value??fallback;if(!Number.isSafeInteger(n)||n<1||n>120000)throw error('ACP_TIMEOUT_INVALID');return n;};

export class AcpSessionClient {
 #process; #state='idle'; #sessionId=null; #active=null; #failure=null; #closePromise=null;
 #timeout; #cancelTimeout; #updateHandler; #stateHandler; #earlyUpdates=[]; #earlyBytes=0;
 constructor(config={},options={}){
  this.#timeout=timeout(options.requestTimeoutMs,ACP_SESSION_LIMITS.requestTimeoutMs);
  this.#cancelTimeout=timeout(options.cancelTimeoutMs,ACP_SESSION_LIMITS.cancelTimeoutMs);
  this.#process=new AcpClientProcess({...config,sessionMode:true,maxStdoutRecordBytes:ACP_SESSION_LIMITS.recordBytes});
  this.#updateHandler=params=>this.#onUpdate(params);
  this.#stateHandler=({state})=>{if(state==='failed'&&!this.#closePromise)this.#abort('ACP_PROCESS_FAILED');};
  this.#process.on('session-update',this.#updateHandler);
  this.#process.on('state',this.#stateHandler);
 }
 get state(){return this.#state;}
 // No text, argv, credentials, raw agent errors or environment appears in diagnostics.
 describe(){return {state:this.#state,sessionCreated:this.#sessionId!==null,activePrompt:!!this.#active,cancelling:!!this.#active?.cancelled,failureCode:this.#failure,authentication:'not-performed',realAgentVerified:false};}
 diagnostics(){return {...this.describe(),transport:this.#process.diagnostics(),retainedTextBytes:this.#active?.bytes??0,retainedUpdates:this.#active?.chunks.length??0,cancelTimerActive:!!this.#active?.timer,earlyUpdateCount:this.#earlyUpdates.length};}
 async start(){
  if(this.#state!=='idle')throw error('ACP_ALREADY_STARTED');
  this.#state='starting';
  try{await this.#process.start();if(this.#closePromise){await this.close();throw error('ACP_CLIENT_CLOSED');}if(this.#failure)throw error(this.#failure);this.#state='initialized';return this.describe();}
  catch{if(this.#closePromise&&!this.#failure){await this.close();throw error('ACP_CLIENT_CLOSED');}await this.#terminate('ACP_INITIALIZE_FAILED');throw error(this.#failure);}
 }
 async newSession(cwd){
  if(this.#state!=='initialized')throw error('ACP_SESSION_ORDER');
  if(typeof cwd!=='string'||!isAbsolute(cwd)||cwd.includes('\0')||cwd.length>4096)throw error('ACP_CWD_INVALID');
  this.#state='creating';
  try{
   const result=await this.#process.requestSession('session/new',{cwd,mcpServers:[]},this.#timeout);
   if(this.#closePromise){await this.close();throw error('ACP_CLIENT_CLOSED');}
   if(this.#failure)throw error(this.#failure);
   if(!plain(result)||typeof result.sessionId!=='string'||!result.sessionId.length||result.sessionId.length>256)throw error('ACP_SESSION_RESPONSE_INVALID');
   this.#sessionId=result.sessionId;
   const early=this.#earlyUpdates;this.#earlyUpdates=[];this.#earlyBytes=0;for(const params of early)this.#onUpdate(params);
   if(this.#failure)throw error(this.#failure);this.#state='ready';return this.describe();
  }catch(cause){if(this.#closePromise&&!this.#failure){await this.close();throw error('ACP_CLIENT_CLOSED');}await this.#terminate(cause?.code==='ACP_SESSION_RESPONSE_INVALID'?cause.code:'ACP_SESSION_CREATE_FAILED');throw error(this.#failure);}
 }
 async prompt(text){
  if(this.#state!=='ready'||this.#active)throw error('ACP_PROMPT_ORDER');
  if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>ACP_SESSION_LIMITS.promptBytes)throw error('ACP_PROMPT_INVALID');
  const turn={chunks:[],bytes:0,seen:0,cancelled:false,timer:null};
  this.#active=turn;this.#state='prompting';
  try{
   const result=await this.#process.requestSession('session/prompt',{sessionId:this.#sessionId,prompt:[{type:'text',text}]},this.#timeout);
   if(this.#failure)throw error(this.#failure);
   if(!plain(result)||!stops.has(result.stopReason)||(turn.cancelled&&result.stopReason!=='cancelled'))throw error('ACP_PROMPT_RESPONSE_INVALID');
   if(turn.cancelled)await this.close();else this.#state='ready';
   return Object.freeze({stopReason:result.stopReason,text:turn.cancelled?'':turn.chunks.join(''),updateCount:turn.seen,cancelled:turn.cancelled||result.stopReason==='cancelled'});
  }catch(cause){
   if(turn.cancelled&&this.#closePromise&&!this.#failure){await this.close();return Object.freeze({stopReason:'cancelled',text:'',updateCount:turn.seen,cancelled:true});}
   await this.#terminate(this.#failure??(['ACP_PROMPT_RESPONSE_INVALID','ACP_REQUEST_TIMEOUT'].includes(cause?.code)?cause.code:'ACP_PROMPT_FAILED'));throw error(this.#failure);
  }
  finally{if(turn.timer)clearTimeout(turn.timer);turn.timer=null;turn.chunks.length=0;turn.bytes=0;if(this.#active===turn)this.#active=null;}
 }
 cancel(){
  const turn=this.#active;
  if(!turn||this.#failure||this.#closePromise)return false;
  if(turn.cancelled)return true;
  turn.cancelled=true;turn.chunks.length=0;turn.bytes=0;this.#state='cancelling';
  try{this.#process.cancelSession(this.#sessionId);}
  catch{this.#abort('ACP_CANCEL_FAILED');return true;}
  turn.timer=setTimeout(()=>this.#abort('ACP_CANCEL_TIMEOUT'),this.#cancelTimeout);
  return true;
 }
 close(){
  if(this.#closePromise)return this.#closePromise;
  if(this.#active){this.#active.cancelled=true;this.#active.chunks.length=0;this.#active.bytes=0;if(this.#active.timer)clearTimeout(this.#active.timer);this.#active.timer=null;}
  this.#earlyUpdates=[];this.#earlyBytes=0;
  this.#state=this.#failure?'failed':'closing';
  this.#closePromise=this.#process.stop('session-client-close').then(result=>{
   if(!result.exited)this.#failure??='ACP_CHILD_EXIT_UNCONFIRMED';
   this.#state=this.#failure?'failed':'closed';return {exited:result.exited,forced:result.forced,failureCode:this.#failure};
  }).finally(()=>{
   this.#process.off('session-update',this.#updateHandler);this.#process.off('state',this.#stateHandler);this.#sessionId=null;
  });
  return this.#closePromise;
 }
 async #terminate(code){this.#failure??=code;this.#state='failed';await this.close();}
 #abort(code){this.#failure??=code;this.#state='failed';void this.close();}
 #onUpdate(params){
  if(this.#closePromise||this.#failure)return;
  // A response and an immediate session notification can share one stdout chunk.
  // Promise continuations run after framing; defer identity validation until new resolves.
  if(this.#state==='creating'&&this.#sessionId===null){
   const bytes=Buffer.byteLength(JSON.stringify(params)??'');
   if(this.#earlyUpdates.length>=ACP_SESSION_LIMITS.updates||this.#earlyBytes+bytes>ACP_SESSION_LIMITS.textBytes){this.#abort('ACP_EARLY_UPDATE_LIMIT');return;}
   this.#earlyUpdates.push(params);this.#earlyBytes+=bytes;return;
  }
  if(!plain(params)||typeof params.sessionId!=='string'||params.sessionId!==this.#sessionId){this.#abort('ACP_UPDATE_SESSION_INVALID');return;}
  const turn=this.#active;
  // v1 allows non-turn session notifications; late content never attaches to a later completed turn.
  if(!turn)return;
  if(++turn.seen>ACP_SESSION_LIMITS.updates){this.#abort('ACP_UPDATE_COUNT_LIMIT');return;}
  const update=params.update;
  if(!plain(update)||!updates.has(update.sessionUpdate)){this.#abort('ACP_UPDATE_INVALID');return;}
  if(update.sessionUpdate!=='agent_message_chunk'||turn.cancelled)return;
  const content=update.content;
  if(!plain(content)||content.type!=='text'||typeof content.text!=='string'){this.#abort('ACP_TEXT_UPDATE_INVALID');return;}
  if(update.messageId!==undefined&&update.messageId!==null&&(typeof update.messageId!=='string'||update.messageId.length>256)){this.#abort('ACP_MESSAGE_ID_INVALID');return;}
  const bytes=Buffer.byteLength(content.text);
  if(turn.bytes+bytes>ACP_SESSION_LIMITS.textBytes){this.#abort('ACP_TEXT_BYTE_LIMIT');return;}
  turn.bytes+=bytes;turn.chunks.push(content.text);
 }
}
