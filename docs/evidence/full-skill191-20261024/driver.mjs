import fs from 'node:fs';import {createStdioClient} from '../../scripts/perf-browser.mjs';
const dir=new URL('./',import.meta.url),file=n=>new URL(n,dir);let client;
try{
 client=await createStdioClient({origin:'http://127.0.0.1:5188',announce:info=>{fs.writeFileSync(file('pairing-secret.json'),JSON.stringify(info),{mode:0o600});fs.chmodSync(file('pairing-secret.json'),0o600);}});
 fs.writeFileSync(file('ready.json'),JSON.stringify({ready:true,environment:'Windows Node formal stdio fallback; registered browser_call absent',origin:'http://127.0.0.1:5188'}));
 let last=0;for(;;){await new Promise(r=>setTimeout(r,150));if(!fs.existsSync(file('request.json')))continue;let request;try{request=JSON.parse(fs.readFileSync(file('request.json')));}catch{continue;}if(request.id<=last)continue;last=request.id;
  if(request.close){await client.close();fs.rmSync(file('pairing-secret.json'),{force:true});fs.writeFileSync(file('closed.json'),JSON.stringify({closed:true,secretRemoved:true}));break;}
  try{const value=await client.call(request.tool,request.args??{});fs.writeFileSync(file('response-'+request.id+'.json'),JSON.stringify({ok:true,value},null,2));}catch(e){fs.writeFileSync(file('response-'+request.id+'.json'),JSON.stringify({ok:false,error:{message:e.message,code:e.code??null}},null,2));}
 }
}catch(e){fs.writeFileSync(file('fatal.json'),JSON.stringify({error:e.message}));if(client)await client.close();fs.rmSync(file('pairing-secret.json'),{force:true});process.exitCode=1;}
