import {initializeHeadlessWorker} from './headless-worker-environment.mjs';
// Best-effort orphan prevention: synchronous native work can delay this handler.
process.on('disconnect',()=>process.exit(0));
if(!process.connected)process.exit(0);
let received=false,rejected=false;
const send=message=>{if(!rejected&&process.connected)process.send(message);};
const ready=initializeHeadlessWorker(send);
ready.catch(()=>{});
process.on('message',async data=>{
 if(received){if(!rejected&&process.connected)process.send({error:'Analysis child accepts only one request'});rejected=true;return;}
 received=true;
 try{const run=await ready;if(!rejected)await run(data);}catch(error){send({error:error?.message??String(error)});}
});
// The IPC listener intentionally keeps the process alive until the parent ends
// ownership after receiving the result. There is no self-retry or second solve.
