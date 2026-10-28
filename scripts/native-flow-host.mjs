import {createServer} from 'node:http';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runSu2Native,su2Capabilities,buildSu2Config} from './su2-native.mjs';
import {parseSu2Vtu,summarizeSu2Result} from '../src/su2-vtu.js';

export async function createNativeFlowHost({origin,executable,meshPath,outputRoot,approvedInput,port=0}){
 if(new URL(origin).origin!==origin)throw Error('Exact browser origin required');
 buildSu2Config(approvedInput);await mkdir(outputRoot,{recursive:true});
 const token=randomBytes(32).toString('base64url'),jobs=new Map(),requests=new Map();let active=null;
 const server=createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   if(req.headers.host!==`127.0.0.1:${server.address().port}`||req.headers.origin!==origin)return send(403,{error:'Origin or Host refused'});
   res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');return send(200,{});}
   if(req.headers.authorization!==`Bearer ${token}`)return send(401,{error:'Native flow token refused'});
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname==='/capabilities'&&req.method==='GET')return send(200,{...su2Capabilities(),input:approvedInput,case:'configured-cow',fixedMesh:true,experimental:true});
   let body;if(req.method==='POST'){let size=0,chunks=[];for await(const b of req){size+=b.length;if(size>65536)throw Error('Native request limit');chunks.push(b);}body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}
   if(url.pathname==='/jobs'&&req.method==='POST'){
    if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(body.requestId))throw Error('requestId required');
    if(body.input!==undefined&&JSON.stringify(body.input)!==JSON.stringify(approvedInput))throw Error('This host only runs the explicitly approved case input');
    if(requests.has(body.requestId))return send(200,{jobId:requests.get(body.requestId)});
    if(active)throw Error('Native flow job already running');if(jobs.size>=4)throw Error('Native flow retained-job limit');
    const jobId=randomUUID(),controller=new AbortController(),job={jobId,status:'running',events:[],controller,settled:false};jobs.set(jobId,job);requests.set(body.requestId,jobId);active=jobId;
    const directory=resolve(outputRoot,jobId);
    job.promise=(async()=>{try{
     const metadata=await runSu2Native({executable,meshPath,outputDirectory:directory,input:approvedInput,timeoutMs:900000,signal:controller.signal,onObservation:event=>{job.events.push(event);if(job.events.length>256)job.events.shift();}});
     const volumes=metadata.artifacts.filter(a=>/^flow(?:_\d+)?\.vtu$/.test(a.name));
     const frames=volumes.map((a,index)=>{const m=a.name.match(/_(\d+)\.vtu$/),timeIndex=m?Number(m[1]):null;return {index,timeIndex,timeSeconds:timeIndex===null?null:timeIndex*approvedInput.timeStepSeconds,volume:a,surface:metadata.artifacts.find(b=>b.name===a.name.replace('flow','surface_flow'))};});
     if(frames.some(f=>!f.surface))throw Error('Missing paired time surface');job.directory=directory;job.frames=frames;
     const last=frames.at(-1),volume=parseSu2Vtu(await readFile(resolve(directory,last.volume.name))),surface=parseSu2Vtu(await readFile(resolve(directory,last.surface.name)));
     job.result={input:approvedInput,metadata,frames,displayedFrame:frames.at(-1).index,volume,surface,summary:summarizeSu2Result(volume,surface)};
     const bytes=Buffer.from(JSON.stringify(job.result));job.resultSha256=createHash('sha256').update(bytes).digest('hex');job.resultBytes=bytes.length;
     await writeFile(resolve(directory,'studio-flow-result.json'),bytes);job.status='completed';job.metadata=metadata;
    }catch(error){job.status=error.code==='SU2_CANCELLED'?'cancelled':'failed';job.error={code:error.code??'NATIVE_FLOW_FAILED',message:error.message,logTail:error.logTail,...(error.diagnostics?{diagnostics:error.diagnostics}:{})};}finally{job.settled=true;active=null;}})();
    return send(202,{jobId});
   }
   const fm=url.pathname.match(/^\/jobs\/([a-f0-9-]+)\/frames\/(\d+)$/);if(fm&&req.method==='GET')return send(200,await readFrame(fm[1],Number(fm[2])));
   const match=url.pathname.match(/^\/jobs\/([a-f0-9-]+)(\/result|\/cancel|\/release)?$/);if(!match) return send(404,{error:'Unknown native route'});
   const job=jobs.get(match[1]);if(!job)return send(404,{error:'Unknown native job'});
   if(match[2]==='/release'&&req.method==='POST'){if(!job.settled)throw Error('Wait for native execution settlement before release');jobs.delete(job.jobId);for(const [key,id] of requests)if(id===job.jobId)requests.delete(key);return send(200,{jobId:job.jobId,released:true,filesDeleted:false});}
   if(match[2]==='/cancel'&&req.method==='POST'){if(job.settled)return send(200,{jobId:job.jobId,cancelRequested:false,status:job.status});job.controller.abort();return send(200,{jobId:job.jobId,cancelRequested:true});}
   if(match[2]==='/result'&&req.method==='GET'){if(job.status!=='completed')throw Error('Native result unavailable');return send(200,job.result);}
   if(!match[2]&&req.method==='GET')return send(200,{jobId:job.jobId,status:job.status,executionSettled:job.settled,latestObservation:job.events.at(-1)??null,...(job.metadata?{metadata:job.metadata,resultSha256:job.resultSha256,resultBytes:job.resultBytes}:{}),...(job.error?{error:job.error}:{})});
   return send(405,{error:'Method refused'});
  }catch(error){if(!res.headersSent)send(400,{error:error.message});else res.destroy();}
 });
 await new Promise((res,rej)=>{server.once('error',rej);server.listen(port,'127.0.0.1',res);});
 async function readFrame(id,index){const job=jobs.get(id);if(!job?.settled||job.status!=='completed'||!Number.isSafeInteger(index)||!job.frames[index])throw Error('Settled registered frame required');const frame=job.frames[index],parsed={};for(const domain of ['volume','surface']){const artifact=frame[domain],bytes=await readFile(resolve(job.directory,artifact.name));if(bytes.length!==artifact.bytes||`sha256:${createHash('sha256').update(bytes).digest('hex')}`!==artifact.sha256)throw Error('Frame artifact integrity mismatch');parsed[domain]=parseSu2Vtu(bytes);}return {input:approvedInput,metadata:job.metadata,frame,frames:job.frames,displayedFrame:index,...parsed,summary:summarizeSu2Result(parsed.volume,parsed.surface)};}
 return {readFrame,endpoint:`http://127.0.0.1:${server.address().port}`,token,async close(){for(const j of jobs.values())if(!j.settled)j.controller.abort();await Promise.allSettled([...jobs.values()].map(j=>j.promise));await new Promise(r=>server.close(r));},jobs};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const path=process.argv[2];if(!path)throw Error('Usage: node scripts/native-flow-host.mjs approved-case.json');
 const config=JSON.parse(await readFile(resolve(path),'utf8'));const host=await createNativeFlowHost(config);
 console.error(`Native flow: ${host.endpoint}\nConnection code: ${host.token}\nOnly the configured mesh and approved input can be executed.`);
 for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>host.close().then(()=>process.exit(0)));
}
