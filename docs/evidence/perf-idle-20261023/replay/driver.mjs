// Reconstructed replay helper; displays pairing only on an interactive terminal, never writes credentials.
import fs from 'node:fs';
import {createStdioClient,waitForSession,runBrowserPerf} from '../../scripts/perf-browser.mjs';
const out=new URL('./',import.meta.url),plan={base:'8c902f3',origin:'http://127.0.0.1:18558',cases:process.argv.includes('--second')?['structural-tiny']:['structural-tiny','structural-medium','structural-fine'],repeats:1,perJobTimeoutMs:60000,idleMs:4000,meshBudget:{nodes:5000,elements:20000},notes:'One added size only; sampled memory is not true peak. Same normalized synthetic exportProject snapshot; formal live inspect before/after every case.'};
let client;
try{
 fs.writeFileSync(new URL('plan.json',out),JSON.stringify(plan,null,2));
 client=await createStdioClient({origin:plan.origin,announce:p=>{console.log('endpoint:',p.endpoint);console.log('pairing code:',process.stdout.isTTY?p.pairingToken:'withheld: run interactively');}});
 console.log('Connector ready; select inspect/analyze only.');
 const session=await waitForSession(client,{timeoutMs:180000,pollMs:500});
 console.log('Paired; baseline sampling5s.');await new Promise(r=>setTimeout(r,5000));
 const report=await runBrowserPerf({client,sessionId:session.sessionId,cases:plan.cases,repeats:1,pollMs:50,timeoutMs:plan.perJobTimeoutMs,idleMs:plan.idleMs,meshBudget:plan.meshBudget,inputSnapshot:fs.readFileSync(new URL('input.snapshot.json',out),'utf8'),log:r=>console.log(JSON.stringify({case:r.id,status:r.status,error:r.error??null}))});
 fs.writeFileSync(new URL('report.raw.json',out),JSON.stringify(report,null,2));console.log('PERF_COMPLETE');
}catch(error){console.error(error.code??error.message);process.exitCode=1;}finally{await client?.close();}
