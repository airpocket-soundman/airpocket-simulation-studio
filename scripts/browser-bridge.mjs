import {restoreAnalysisError} from '../src/analysis-failure.js';
import {createServer} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';

// Ephemeral transport only: it never serves files, evaluates code or exposes a shell.
export async function createBrowserBridge({origin,port=0,ttlMs=600000,timeoutMs=15000,now=Date.now}={}) {
 const allowed=new URL(origin);if(allowed.origin!==origin||!['http:','https:'].includes(allowed.protocol))throw Error('Use an exact browser origin');
 const pairingToken=randomBytes(32).toString('base64url'),sessions=new Map();let closed=false;
 const counters={requests:0,preflights:0,healthChecks:0,pairSuccess:0,pairRefused:0,originHostRefused:0,authRefused:0,disconnects:0,expiredSessions:0,requestErrors:0,scopeRefused:0,commandTimeouts:0};
 const count=key=>{counters[key]=Math.min(Number.MAX_SAFE_INTEGER,counters[key]+1);};
 const fail=(message,code='BROWSER_BRIDGE_ERROR')=>Object.assign(Error(message),{code});
 function remove(id,reason){const s=sessions.get(id);if(!s)return;for(const c of s.commands.values()){clearTimeout(c.timer);c.reject(fail(reason));}sessions.delete(id);}
 function expire(){for(const [id,s]of sessions)if(now()-s.touched>=ttlMs){count('expiredSessions');remove(id,'Browser session expired');}}
 const server=createServer(async(req,res)=>{
  count('requests');
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
   if(req.headers.host!==`127.0.0.1:${server.address().port}`||req.headers.origin!==origin){count('originHostRefused');if(req.headers.origin===origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}return send(403,{error:'Origin or host refused'});}
   res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
   if(req.method==='OPTIONS'){count('preflights');res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');return send(200,{});}
   if(req.url==='/health'&&req.method==='GET'){count('healthChecks');return send(200,{schemaVersion:1,kind:'airpocket-browser-bridge'});}
   expire();const token=req.headers.authorization?.replace(/^Bearer /,'');
   let body={};if(req.method==='POST'){let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>1000000)throw fail('Request exceeds one megabyte');chunks.push(chunk);}body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}
   if(req.url==='/pair'&&req.method==='POST'){
    if(token!==pairingToken){count('pairRefused');return send(401,{error:'Invalid pairing token'});}
    if(sessions.size>=8)throw fail('Browser session limit reached');
    if(!Array.isArray(body.scopes)||!body.scopes.length||body.scopes.some(x=>!['inspect','edit','analyze','view'].includes(x)))throw fail('Invalid scopes');
    const id=randomUUID(),secret=randomBytes(32).toString('base64url');sessions.set(id,{id,secret,scopes:[...new Set(body.scopes)],touched:now(),commands:new Map()});count('pairSuccess');return send(200,{sessionId:id,token:secret,expiresAfterIdleMs:ttlMs});
   }
   const s=[...sessions.values()].find(x=>x.secret===token);if(!s){count('authRefused');return send(401,{error:'Session expired or revoked'});}s.touched=now();
   if(req.url==='/poll'&&req.method==='GET'){const commands=[...s.commands.values()].filter(c=>!c.delivered&&now()<c.expiresAt);commands.forEach(c=>c.delivered=true);return send(200,{commands:commands.map(({id,method,args,expiresAt})=>({id,method,args,expiresAt}))});}
   if(req.url==='/reply'&&req.method==='POST'){const c=s.commands.get(body.id);if(!c)return send(200,{ok:true,accepted:false,reason:'Command expired or was already completed'});clearTimeout(c.timer);s.commands.delete(c.id);if(body.error)c.reject(Object.assign(restoreAnalysisError(String(body.error.message||'Browser operation failed'),body.error.failure),{code:String(body.error.code||'BROWSER_OPERATION_FAILED')}));else c.resolve(body.value);return send(200,{ok:true,accepted:true});}
   if(req.url==='/disconnect'&&req.method==='POST'){count('disconnects');remove(s.id,'Browser disconnected');return send(200,{ok:true});}
   send(404,{error:'Unknown bridge route'});
  }catch(error){count('requestErrors');if(req.url==='/pair'&&req.method==='POST')count('pairRefused');if(!res.headersSent)send(400,{error:error.message});else res.destroy();}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 const sweep=setInterval(expire,Math.min(ttlMs,10000));sweep.unref();
 const endpoint=`http://127.0.0.1:${server.address().port}`;
 return {
  endpoint,pairingToken,origin,
  diagnostics(){expire();return {schemaVersion:1,kind:'airpocket-browser-bridge-diagnostics',origin,endpoint,sessionCount:sessions.size,counters:{...counters},limitations:['Counters describe requests observed by this bridge only; absent requests do not identify browser, network or permission failure causes.','No incoming origins, URLs, headers, tokens, session identifiers or model data are retained in diagnostics.']};},
  list(){expire();return [...sessions.values()].map(({id,scopes,touched})=>({sessionId:id,scopes,lastSeen:new Date(touched).toISOString()}));},
  call(sessionId,method,args={},scope='inspect'){
   expire();const s=sessions.get(sessionId);if(closed||!s)return Promise.reject(fail('Browser session unavailable'));
   if(!s.scopes.includes(scope)){count('scopeRefused');return Promise.reject(fail('Browser permission scope refused','BROWSER_SCOPE_REFUSED'));}
   if(s.commands.size>=16)return Promise.reject(fail('Browser command limit reached'));
   if(JSON.stringify(args).length>500000)return Promise.reject(fail('Command exceeds size limit'));
   return new Promise((resolve,reject)=>{const id=randomUUID(),timer=setTimeout(()=>{s.commands.delete(id);count('commandTimeouts');reject(fail('Browser command timed out; inspect state before retrying','BROWSER_COMMAND_TIMEOUT'));},timeoutMs);s.commands.set(id,{id,method,args,resolve,reject,timer,delivered:false,expiresAt:now()+timeoutMs});});
  },
  async close(){closed=true;clearInterval(sweep);for(const id of sessions.keys())remove(id,'Bridge stopped');await new Promise(resolve=>server.close(resolve));}
 };
}
