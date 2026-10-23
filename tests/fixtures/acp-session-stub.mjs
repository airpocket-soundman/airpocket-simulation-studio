// Synthetic real subprocess only. Never starts an actual AI agent or tool.
import {createInterface} from 'node:readline';
const mode=process.argv[2]??'normal';
const send=v=>process.stdout.write(JSON.stringify(v)+'\n');
const response=(id,result)=>send({jsonrpc:'2.0',id,result});
const update=(text,sessionId='synthetic-session')=>send({jsonrpc:'2.0',method:'session/update',params:{sessionId,update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text}}}});
let promptId;
const lines=createInterface({input:process.stdin});
lines.on('line',line=>{
 const msg=JSON.parse(line);
 if(msg.method==='initialize'){const reply=()=>response(msg.id,{protocolVersion:1,agentCapabilities:{},authMethods:[]});return mode==='delayed-initialize'?setTimeout(reply,10):reply();}
 if(msg.method==='session/new'){if(mode==='new-then-update'){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result:{sessionId:'synthetic-session'}})+'\n'+JSON.stringify({jsonrpc:'2.0',method:'session/update',params:{sessionId:'synthetic-session',update:{sessionUpdate:'available_commands_update',availableCommands:[]}}})+'\n');return;}const reply=()=>response(msg.id,{sessionId:mode==='bad-session'?'':'synthetic-session'});return mode==='delayed-new'?setTimeout(reply,10):reply();}
 if(msg.method==='session/prompt'){
  promptId=msg.id;
  if(mode==='failure-flood'){process.stdout.write('not-json\n');setInterval(()=>process.stdout.write('{"jsonrpc":"2.0","method":"session/update"}\n'.repeat(256)),1);return;}
  if(mode==='request-flood'){process.stdin.pause();for(let i=0;i<1000;i++)send({jsonrpc:'2.0',id:String(i)+'x'.repeat(1024),method:'session/request_permission',params:{sessionId:'synthetic-session'}});return;}
  if(mode==='exit')return process.exit(0);
  if(mode==='wrong-id')return response(9999,{stopReason:'end_turn'});
  if(mode==='invalid-utf8')return process.stdout.write(Buffer.from([255,10]));
  if(mode==='bad-update')return send({jsonrpc:'2.0',method:'session/update',params:{sessionId:'synthetic-session',update:{sessionUpdate:'agent_message_chunk',content:{type:'image',data:'x'}}}});
  if(mode==='wrong-session')return update('synthetic','wrong-session');
  if(mode==='huge-record')return update('x'.repeat(70000));
  if(mode==='many-updates'){for(let i=0;i<129;i++)update('x');return;}
  if(mode==='huge-text'){update('x'.repeat(40000));update('x'.repeat(40000));return;}
  if(mode==='bad-stop')return response(promptId,{stopReason:'not-in-v1'});
  if(mode==='permission'||mode==='filesystem')return send({jsonrpc:'2.0',id:777,method:mode==='permission'?'session/request_permission':'fs/read_text_file',params:{sessionId:'synthetic-session',path:'never-opened'}});
  update('合成');
  if(['wait','cancel-ignore','cancel-bad','ignore-eof'].includes(mode))return;
  update('応答🙂');response(promptId,{stopReason:'end_turn'});return;
 }
 if(msg.id===777){
  const refused=mode==='permission'?msg.result?.outcome?.outcome==='cancelled':msg.error?.code===-32601;
  return response(promptId,{stopReason:refused?'end_turn':'bad-permission'});
 }
 if(msg.method==='session/cancel'&&promptId){
  update('取消後の通知');
  if(mode==='cancel-ignore'||mode==='ignore-eof')return;
  return response(promptId,{stopReason:mode==='cancel-bad'?'end_turn':'cancelled'});
 }
});
lines.on('close',()=>{if(mode.startsWith('delayed-'))setTimeout(()=>process.exit(0),50);else if(!['ignore-eof','failure-flood'].includes(mode))process.exit(0);});
if(mode==='ignore-eof')setInterval(()=>{},1000);
