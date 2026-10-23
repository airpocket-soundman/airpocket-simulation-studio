import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAgentChatState,AGENT_CHAT_LIMITS} from '../src/agent-chat-state.js';
import {AcpSessionClient} from '../scripts/acp-session-client.mjs';
import {fileURLToPath} from 'node:url';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const reply=text=>({text,cancelled:false,stopReason:'end_turn'});
const provider=(options={})=>({describe:()=>({state:'ready'}),prompt:async text=>reply(text),cancel:async()=>{},...options});
test('unavailable, initialization, authentication and terminal phases never send',async()=>{
 const model=createAgentChatState();assert.equal(model.snapshot().phase,'unavailable');
 for(const phase of ['idle','starting','initialized','creating','authentication-required','failed','closed']){model.setProvider(provider({describe:()=>({state:phase})}));assert.equal(model.snapshot().phase,phase);await assert.rejects(model.send('x'),/CHAT_NOT_READY/);}
 assert.throws(()=>model.setProvider({}),/CHAT_PROVIDER_INVALID/);model.setProvider(provider());assert.equal(model.snapshot().canSend,true);
});
test('one prompt, exact text, history snapshot isolation and opaque errors',async()=>{
 const turn=deferred(),model=createAgentChatState();model.setProvider(provider({prompt:()=>turn.promise}));const sending=model.send('<script>日本語</script>');await assert.rejects(model.send('second'),/CHAT_NOT_READY/);assert.equal(model.snapshot().phase,'prompting');turn.resolve(reply('<b>answer</b>'));assert.equal(await sending,true);
 const state=model.snapshot();assert.equal(state.messages[1].text,'<b>answer</b>');state.messages[1].text='tamper';assert.equal(model.snapshot().messages[1].text,'<b>answer</b>');
 model.setProvider(provider({prompt:async()=>{throw Error('secret token');}}));assert.equal(await model.send('x'),false);assert.equal(model.snapshot().failureCode,'CHAT_PROMPT_FAILED');assert.ok(!JSON.stringify(model.snapshot()).includes('secret'));
});
test('session replacement, cancellation and disposal discard late success or failure',async()=>{
 for(const ending of ['resolve','reject','cancel','destroy']){
  const turn=deferred();let cancels=0;const model=createAgentChatState();model.setProvider(provider({prompt:()=>turn.promise,cancel:async()=>{cancels++;}}));const old=model.send('old');
  const stopping=ending==='cancel'?model.stop():null;if(ending==='destroy')model.destroy();else if(ending!=='cancel')model.setProvider(provider());
  if(ending==='reject')turn.reject(Error('late secret'));else turn.resolve(reply('old result'));assert.equal(await old,false);await stopping;await Promise.resolve();assert.equal(cancels,1);assert.ok(!JSON.stringify(model.snapshot()).includes('old result'));
  if(ending!=='destroy'){model.setProvider(provider());assert.equal(await model.send('fresh'),true);assert.equal(model.snapshot().messages.at(-1).text,'fresh');}
 }
});
test('cancel completion cannot change a newly selected session',async()=>{
 const cancel=deferred(),turn=deferred(),model=createAgentChatState();model.setProvider(provider({prompt:()=>turn.promise,cancel:()=>cancel.promise}));const old=model.send('old'),stopping=model.stop();assert.equal(model.snapshot().phase,'cancelling');model.setProvider(provider());await model.send('new');cancel.reject(Error('late cancellation'));await stopping;turn.resolve(reply('old'));await old;assert.equal(model.snapshot().failureCode,null);assert.equal(model.snapshot().messages.at(-1).text,'new');
});
test('UTF8 limits and retained history remain bounded without truncating replies',async()=>{
 const model=createAgentChatState();model.setProvider(provider());await assert.rejects(model.send('あ'.repeat(6000)),/CHAT_PROMPT_INVALID/);await assert.rejects(model.send('  '),/CHAT_PROMPT_INVALID/);
 model.setProvider(provider({prompt:async()=>reply('あ'.repeat(22000))}));assert.equal(await model.send('x'),false);assert.equal(model.snapshot().failureCode,'CHAT_PROMPT_FAILED');
 model.setProvider(provider({prompt:async()=>reply('a'.repeat(AGENT_CHAT_LIMITS.responseBytes))}));for(let i=0;i<20;i++)await model.send('turn '+i);const state=model.snapshot();assert.ok(state.messages.length<=16);assert.ok(state.messages.reduce((sum,m)=>sum+Buffer.byteLength(m.text),0)<=AGENT_CHAT_LIMITS.historyBytes);
});
test('a provider change during a state notification cannot start the obsolete prompt',async()=>{
 let model,calls=0;model=createAgentChatState({onChange:state=>{if(state.phase==='prompting')model.setProvider(provider());}});model.setProvider(provider({prompt:async()=>{calls++;return reply('old');}}));assert.equal(await model.send('x'),false);assert.equal(calls,0);assert.equal(model.snapshot().messages.length,0);
});
test('retired provider A cannot be reused after A→B→A while its old cancellation is outstanding',async()=>{
 const old=deferred(),cancelled=deferred();let calls=0;const a=provider({prompt:()=>{calls++;return old.promise;},cancel:()=>cancelled.promise}),model=createAgentChatState();model.setProvider(a);const pending=model.send('old');old.resolve(reply('old'));model.setProvider(provider());assert.throws(()=>model.setProvider(a),/CHAT_PROVIDER_RETIRED/);assert.equal(await model.send('new'),true);cancelled.resolve();assert.equal(await pending,false);assert.equal(calls,1);assert.equal(model.snapshot().messages.at(-1).text,'new');
});
test('real ACP cancellation waits for the pending turn and child shutdown',async()=>{
 const client=new AcpSessionClient({executable:process.execPath,argv:[fileURLToPath(new URL('./fixtures/acp-session-stub.mjs',import.meta.url)),'wait'],cwd:process.cwd(),installSignalHandlers:false});const model=createAgentChatState();
 try{await client.start();await client.newSession(process.cwd());model.setProvider(client);const sending=model.send('cancel me');assert.equal(await model.stop(),true);assert.equal(await sending,false);assert.equal(model.snapshot().phase,'closed');assert.equal(client.diagnostics().transport.activeChild,false);}finally{model.destroy();await client.close();}
});
test('real bounded ACP subprocess provider completes a text turn and closes',async()=>{
 const client=new AcpSessionClient({executable:process.execPath,argv:[fileURLToPath(new URL('./fixtures/acp-session-stub.mjs',import.meta.url)),'normal'],cwd:process.cwd(),installSignalHandlers:false});const model=createAgentChatState();
 try{await client.start();await client.newSession(process.cwd());model.setProvider(client);assert.equal(await model.send('hello'),true);assert.equal(model.snapshot().failureCode,null);assert.equal(model.snapshot().messages.length,2);}finally{model.destroy();await client.close();}
});
