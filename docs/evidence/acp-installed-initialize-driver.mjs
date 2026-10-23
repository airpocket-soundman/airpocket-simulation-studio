// Explicit, prompt-free diagnostic. No PATH search, installation or login.
// Usage: node docs/evidence/acp-installed-initialize-driver.mjs --adapter=<absolute existing bundle>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {AcpSessionClient} from '../../scripts/acp-session-client.mjs';
const adapter=process.argv.find(v=>v.startsWith('--adapter='))?.slice(10);
if(process.argv.length!==3||!adapter||!path.isAbsolute(adapter))throw Error('Explicit absolute adapter bundle required');
const hash=createHash('sha256').update(fs.readFileSync(adapter)).digest('hex');
if(hash!=='6b1bb4e7e9caaf4aeca1042ae4aec2dc2433b0b0e4b1614b38a4d41699902aaa')throw Error('Unreviewed adapter bundle');
if(process.platform!=='win32')throw Error('Observed process cleanup diagnostic requires Windows');
const suppressed=['APP_SERVER_LOGS','DEFAULT_AUTH_REQUEST','CODEX_CONFIG','CODEX_PATH','MODEL_PROVIDER'];
for(const key of suppressed)delete process.env[key]; // Only this diagnostic process; no global configuration changes.
const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'airpocket-acp-initialize-'));
const snapshot=()=>{const r=spawnSync('powershell.exe',['-NoProfile','-Command','Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress'],{encoding:'utf8',timeout:10000,windowsHide:true});if(r.status!==0)throw Error('Process snapshot unavailable');return JSON.parse(r.stdout);};
const descendants=(rows,pid)=>rows.filter(p=>p.ParentProcessId===pid).flatMap(p=>[p,...descendants(rows,p.ProcessId)]);
const client=new AcpSessionClient({executable:process.execPath,argv:[adapter],cwd,initializeTimeoutMs:10000,stopGraceMs:2000,forceKillWaitMs:2000},{requestTimeoutMs:10000,cancelTimeoutMs:2000});
const report={operation:'initialize-only',adapterSha256:hash,environmentNamesSuppressed:suppressed,globalConfigurationChanged:false,sessionNewExecuted:false,promptSent:false,authenticationChanged:false};
const started=performance.now();let owned=[];
try{await client.start();report.initialized=client.describe();owned=descendants(snapshot(),process.pid).filter(p=>!['powershell.exe','conhost.exe'].includes(p.Name));report.observedOwnedProcessCount=owned.length;}catch{report.failureCode='ACP_INITIALIZE_DIAGNOSTIC_FAILED';}
finally{
 report.closeResult=await client.close();report.final=client.diagnostics();report.elapsedMs=Math.round(performance.now()-started);
 try{const after=snapshot();report.observedOwnedProcessesStillRunning=owned.filter(p=>after.some(a=>a.ProcessId===p.ProcessId&&a.Name===p.Name)).length;}catch{report.processCleanupObservationUnavailable=true;}
 report.syntheticCwdRemainingEntries=fs.readdirSync(cwd).length;
 if(report.syntheticCwdRemainingEntries===0)fs.rmdirSync(cwd);
}
console.log(JSON.stringify(report,null,2));
if(report.failureCode||!report.closeResult.exited||report.observedOwnedProcessesStillRunning!==0)process.exitCode=1;
