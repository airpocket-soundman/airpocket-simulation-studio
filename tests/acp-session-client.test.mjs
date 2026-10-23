import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {AcpSessionClient,ACP_SESSION_LIMITS} from '../scripts/acp-session-client.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),fixture=fileURLToPath(new URL('./fixtures/acp-session-stub.mjs',import.meta.url));
const make=(mode,options={})=>new AcpSessionClient({executable:process.execPath,argv:[fixture,mode],cwd:root,installSignalHandlers:false,stopGraceMs:100,forceKillWaitMs:1000},options);
async function ready(t,mode='normal',options={}){const c=make(mode,options);t.after(()=>c.close());await c.start();await c.newSession(root);return c;}
function clean(c){const d=c.diagnostics();assert.equal(d.transport.activeChild,false);assert.equal(d.transport.activeTimers,0);assert.equal(d.transport.pendingRequests,0);assert.equal(d.cancelTimerActive,false);assert.equal(d.retainedTextBytes,0);}
test('text sessions preserve Unicode through real stdio and support sequential prompts without diagnostics leaking content',async t=>{
 const c=await ready(t);assert.equal(c.state,'ready');
 for(let i=0;i<2;i++){const r=await c.prompt('合成の入力');assert.equal(r.text,'合成応答🙂');assert.equal(r.stopReason,'end_turn');assert.equal(r.updateCount,2);assert.ok(!JSON.stringify(c.diagnostics()).includes('合成'));}
 assert.equal(c.describe().authentication,'not-performed');await c.close();clean(c);
});
test('one session/one prompt: ordering, invalid prompt and concurrent calls are refused',async t=>{
 const c=make('wait');t.after(()=>c.close());await assert.rejects(c.prompt('x'),{code:'ACP_PROMPT_ORDER'});await c.start();
 await assert.rejects(c.newSession('relative'),{code:'ACP_CWD_INVALID'});await c.newSession(root);
 await assert.rejects(c.newSession(root),{code:'ACP_SESSION_ORDER'});
 for(const text of ['', ' ', 'x'.repeat(ACP_SESSION_LIMITS.promptBytes+1)])await assert.rejects(c.prompt(text),{code:'ACP_PROMPT_INVALID'});
 const pending=c.prompt('synthetic');await assert.rejects(c.prompt('second'),{code:'ACP_PROMPT_ORDER'});assert.equal(c.cancel(),true);assert.equal((await pending).cancelled,true);clean(c);
});
test('cancel accepts the acknowledgement but discards late text and closes the old session',async t=>{
 const c=await ready(t,'wait');const pending=c.prompt('synthetic');assert.equal(c.cancel(),true);assert.equal(c.cancel(),true);
 const r=await pending;assert.equal(r.stopReason,'cancelled');assert.equal(r.text,'');assert.equal(c.state,'closed');assert.equal(c.cancel(),false);
 await assert.rejects(c.prompt('old session'),{code:'ACP_PROMPT_ORDER'});assert.deepEqual(await c.close(),await c.close());clean(c);
});
test('explicit close settles an active prompt as cancelled and is idempotent',async t=>{
 const c=await ready(t,'wait');const pending=c.prompt('synthetic');const closing=c.close();
 assert.equal((await pending).cancelled,true);assert.equal((await closing).exited,true);assert.equal(c.state,'closed');clean(c);
});
test('cancel timeout has a bounded failure and force-stops a child ignoring EOF',async t=>{
 const c=await ready(t,'ignore-eof',{cancelTimeoutMs:150,requestTimeoutMs:3000});
 const pending=c.prompt('synthetic');c.cancel();await assert.rejects(pending,{code:'ACP_CANCEL_TIMEOUT'});assert.equal(c.state,'failed');assert.equal((await c.close()).forced,true);clean(c);
});
test('prompt timeout closes the owned child without exposing raw remote error messages',async t=>{
 const c=await ready(t,'wait',{requestTimeoutMs:400});await assert.rejects(c.prompt('synthetic'),{code:'ACP_REQUEST_TIMEOUT'});clean(c);
});
for(const [mode,code] of [['wrong-session','ACP_UPDATE_SESSION_INVALID'],['bad-update','ACP_TEXT_UPDATE_INVALID'],['many-updates','ACP_UPDATE_COUNT_LIMIT'],['huge-text','ACP_TEXT_BYTE_LIMIT'],['huge-record','ACP_PROCESS_FAILED'],['wrong-id','ACP_PROCESS_FAILED'],['invalid-utf8','ACP_PROCESS_FAILED'],['exit','ACP_PROCESS_FAILED'],['bad-stop','ACP_PROMPT_RESPONSE_INVALID'],['cancel-bad','ACP_PROMPT_RESPONSE_INVALID']]){
 test('refuses '+mode+' and releases every owned resource',async t=>{const c=await ready(t,mode);const p=c.prompt('synthetic');if(mode==='cancel-bad')c.cancel();await assert.rejects(p,{code});clean(c);});
}
test('invalid new-session response never becomes conversation-ready',async t=>{
 const c=make('bad-session');t.after(()=>c.close());await c.start();await assert.rejects(c.newSession(root),{code:'ACP_SESSION_RESPONSE_INVALID'});clean(c);
});
for(const mode of ['permission','filesystem'])test(mode+' requests are refused without granting client tools',async t=>{
 const c=await ready(t,mode);const result=await c.prompt('synthetic');assert.equal(result.stopReason,'end_turn');assert.equal(result.text,'');await c.close();clean(c);
});

for(const phase of ['initialize','new'])test('close during '+phase+' cannot publish a successful ready state',async t=>{
 const c=make('delayed-'+phase);t.after(()=>c.close());
 let pending;
 if(phase==='initialize')pending=c.start();else{await c.start();pending=c.newSession(root);}
 const closing=c.close();await assert.rejects(pending,{code:'ACP_CLIENT_CLOSED'});await closing;
 assert.equal(c.state,'closed');assert.equal(c.describe().failureCode,null);clean(c);
});
test('agent request flood cannot build an unbounded outgoing reply backlog',async t=>{
 const c=await ready(t,'request-flood',{requestTimeoutMs:3000});await assert.rejects(c.prompt('synthetic'),{code:'ACP_PROCESS_FAILED'});clean(c);
});

test('new-session response and immediate legal notification in one stdout chunk do not race identity validation',async t=>{
 const c=await ready(t,'new-then-update');assert.equal(c.state,'ready');assert.equal(c.diagnostics().earlyUpdateCount,0);assert.equal((await c.prompt('synthetic')).text,'合成応答🙂');await c.close();clean(c);
});

test('stdout after protocol failure is discarded while waiting for a child ignoring EOF',async t=>{
 const c=await ready(t,'failure-flood');await assert.rejects(c.prompt('synthetic'),{code:'ACP_PROCESS_FAILED'});clean(c);assert.equal(c.diagnostics().transport.stdoutRetainedBytes,0);
});
