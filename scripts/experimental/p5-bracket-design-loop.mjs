// P5 second step: one design-iteration loop on SYNTHETIC plate brackets driven only through the real studio MCP stdio server.
// Round 1 solves three thicknesses at three mesh sizes each (per-variant convergence), a recorded rule picks the next
// thickness from the finest results, and round 2 solves that candidate the same way. Geometry is a built-in box (not STEP);
// the deflection target, load and Poisson ratio are synthetic, unconfirmed assumptions. Prints evidence JSON on stdout.
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir,platform,arch} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const WIDTH=20,LENGTH=60,ROUND1=[2,3,4],FORCE_N=10,MATERIAL='rtp-105-cc',POISSON=.35,SIZES=[2,1.4,1],TARGET_MM=1,CONVERGED=.05,POINT=[WIDTH/2,1,LENGTH-.5];
const op=(method,...args)=>({method,args});
const read=(p,pointer)=>pointer.slice(1).split('/').reduce((v,key)=>v?.[key.replace(/~1/g,'/').replace(/~0/g,'~')],p);
function server(){
 const child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:root,stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let id=0,stderr='';child.stderr.on('data',v=>stderr=(stderr+v).slice(-4000));
 lines.on('line',line=>{const m=JSON.parse(line);pending.get(m.id)?.(m);});
 const request=(method,params,ms=300000)=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('MCP timeout '+method+' '+stderr));},ms);pending.set(key,m=>{clearTimeout(timer);pending.delete(key);resolve(m);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n');});
 const calls=[];
 return {request,calls,async call(name,args){calls.push(name);const r=(await request('tools/call',{name,arguments:args})).result;if(r?.isError)throw Error(name+': '+r.content?.[0]?.text);return r.structuredContent.value;},async init(){await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'p5-bracket-loop',version:'1'}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');},close(){child.kill();lines.close();}};
}
async function finished(mcp,jobId){const deadline=Date.now()+600000;while(Date.now()<deadline){const job=await mcp.call('studio_job_status',{jobId});if(['succeeded','failed','cancelled','timed_out'].includes(job.state))return job;await new Promise(r=>setTimeout(r,100));}throw Error('job timeout '+jobId);}
async function variant(mcp,dir,catalog,t){
 const p=name=>join(dir,`t${t}-${name}.json`),solves=[];
 const created=await mcp.call('studio_create_builtin_project',{source:{kind:'box',bounds:[0,0,0,WIDTH,t,LENGTH]},outputPath:p('created'),name:`Synthetic plate bracket t=${t} mm`});
 // Same load and support for every variant: root face z=0 fixed, tip face z=LENGTH loaded in -y (bending through thickness).
 const configured=await mcp.call('studio_edit_project',{path:p('created'),outputPath:p('configured'),expectedRevision:created.revision,operations:[
  op('selectPlanarRegion',0,{axis:2,position:0,min:[0,0],max:[WIDTH,t]}),op('addCondition',{type:'fixed'}),
  op('selectPlanarRegion',0,{axis:2,position:LENGTH,min:[0,0],max:[WIDTH,t]}),op('addCondition',{type:'force',value:FORCE_N,direction:[0,-1,0]}),
  op('applyCatalogMaterial',{id:MATERIAL,expectedCatalogVersion:catalog.version,poissonRatio:POISSON,isotropicApproximation:true,allowExperimental:false,applicability:'Synthetic P5 thickness comparison only; room-temperature linear static, creep and fibre orientation omitted.'}),
  op('setStudy',{kind:'structural',gravityEnabled:false}),op('setAnalysisIntent',{mode:'exploratory'})]});
 const pre=await mcp.call('studio_preflight_project',{path:p('configured')}),project=JSON.parse(await readFile(p('configured'),'utf8'));
 const entries=pre.requiredPointers.map(pointer=>({pointer,value:read(project,pointer),source:{kind:'agent-proposal'},rationale:'P5 synthetic design loop: identical across all variants and rounds',applicability:'Synthetic plate bracket comparison only',assumption:'Unconfirmed agent assumption; not a user-confirmed design value',status:'unconfirmed'}));
 const prov=await mcp.call('studio_edit_project',{path:p('configured'),outputPath:p('ready'),expectedRevision:configured.revision,operations:[op('setInputProvenance',{schemaVersion:1,entries})]});
 const ready=await mcp.call('studio_preflight_project',{path:p('ready')});if(!ready.allowed)throw Error('preflight refused t='+t+': '+JSON.stringify(ready.diagnostics));
 for(const size of SIZES){
  const started=await mcp.call('studio_start_analysis',{path:p('ready'),outputPath:p(`result-${size}`),requestId:`p5-loop-t${t}-h${size}`,size,includeFields:true});
  const job=await finished(mcp,started.jobId);if(job.state!=='succeeded')throw Error('job '+job.state+' '+JSON.stringify(job.error));
  const events=await mcp.call('studio_job_events',{jobId:started.jobId,limit:100});await mcp.call('studio_release_job',{jobId:started.jobId});
  const saved=JSON.parse(await readFile(job.result.outputPath,'utf8'));
  solves.push({meshSizeMm:size,jobId:started.jobId,state:job.state,provisional:job.result.job.provisional,nodeCount:saved.mesh.nodes.length/3,elementCount:saved.mesh.tetrahedra.length,eventStages:[...new Set(events.events.map(e=>e.stage))],maxDisplacementMm:job.result.maxDisplacementMm,maxVonMisesPa:job.result.maxVonMisesPa,saved});
 }
 const E=solves[0].saved.input.materialProperties.youngModulus,I=WIDTH*t**3/12*1e-12,L=LENGTH*1e-3,[,mid,fine]=solves,change=Math.abs(fine.maxDisplacementMm-mid.maxDisplacementMm)/fine.maxDisplacementMm;
 return {thicknessMm:t,inputRevision:prov.revision,preflight:{allowed:ready.allowed,provisional:ready.provisional,requiredPointers:pre.requiredPointers},solves,
  convergence:{metric:'relative change of max displacement between the two finest sizes',change,threshold:CONVERGED,converged:change<CONVERGED},
  finestMaxDisplacementMm:fine.maxDisplacementMm,eulerBernoulliTipMm:FORCE_N*L**3/(3*E*I)*1e3,volumeMm3:WIDTH*t*LENGTH,saved:fine.saved};
}
// Recorded decision rule: fit d = a*t^b to the finest-mesh max displacements (least squares in log-log) and take the
// thinnest t that meets the synthetic target, rounded up to 0.1 mm. Unconverged variants are flagged, not hidden.
function decide(rows){
 const x=rows.map(r=>Math.log(r.thicknessMm)),y=rows.map(r=>Math.log(r.finestMaxDisplacementMm)),n=x.length,mx=x.reduce((a,b)=>a+b)/n,my=y.reduce((a,b)=>a+b)/n;
 const b=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/x.reduce((s,v)=>s+(v-mx)**2,0),a=Math.exp(my-b*mx),exact=(TARGET_MM/a)**(1/b),next=Math.ceil(exact*10-1e-9)/10;
 const meeting=rows.filter(r=>r.finestMaxDisplacementMm<=TARGET_MM).map(r=>r.thicknessMm);
 return {rule:`fit d=a*t^b on finest-mesh max displacement; choose thinnest t (0.1 mm step) with predicted d <= ${TARGET_MM} mm`,fit:{a,b},exactThicknessMm:exact,nextThicknessMm:next,round1MeetingTarget:meeting,
  unconvergedInputs:rows.filter(r=>!r.convergence.converged).map(r=>r.thicknessMm),
  rationale:`Round 1 thinnest passing variant is ${meeting.length?Math.min(...meeting)+' mm':'none'}; the fit predicts ${next} mm reaches the target.`};
}
const dir=await mkdtemp(join(tmpdir(),'p5-loop-')),mcp=server();
try{
 await mcp.init();const catalog=await mcp.call('studio_material_catalog',{id:MATERIAL}),rows=[];
 for(const t of ROUND1)rows.push(await variant(mcp,dir,catalog,t));
 const decision=decide(rows);if(ROUND1.includes(decision.nextThicknessMm))throw Error('decision repeats a round-1 variant');
 const round2=await variant(mcp,dir,catalog,decision.nextThicknessMm);rows.push(round2);
 decision.outcome={thicknessMm:round2.thicknessMm,finestMaxDisplacementMm:round2.finestMaxDisplacementMm,predictedMm:decision.fit.a*round2.thicknessMm**decision.fit.b,meetsTarget:round2.finestMaxDisplacementMm<=TARGET_MM,converged:round2.convergence.converged,
  volumeSavingVsThinnestPassing:decision.round1MeetingTarget.length?1-round2.volumeMm3/(WIDTH*Math.min(...decision.round1MeetingTarget)*LENGTH):null};
 // Case comparison through the same MCP: saved-case archive of the four finest outputs, one shared point near the tip.
 const archivePath=join(dir,'cases.json');await writeFile(archivePath,JSON.stringify({version:1,cases:rows.map(r=>({name:`Synthetic plate bracket t=${r.thicknessMm} mm (h=${SIZES.at(-1)})`,output:r.saved}))}));
 let comparison;try{const listing=await mcp.call('studio_compare_cases',{path:archivePath});comparison={listing:listing.cases.map(c=>({name:c.name,caseId:c.caseId})),result:await mcp.call('studio_compare_cases',{path:archivePath,expectedArchiveRevision:listing.archiveRevision,point:POINT,references:listing.cases.map(c=>({caseId:c.caseId,expectedRevision:c.revision,field:'displacement'}))})};}catch(error){comparison={error:String(error.message).slice(0,800)};}
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),script=await readFile(new URL(import.meta.url));
 console.log(JSON.stringify({schemaVersion:1,task:'97-P5',previous:'92-P5 (docs/evidence/2026-10-29-opencode-92-p5.json)',date:new Date().toISOString().slice(0,10),baseSha:git(['rev-parse','HEAD']),scriptHash:sha(script),serverHash:sha(await readFile(new URL('scripts/studio-mcp.mjs',root))),
  environment:{node:process.version,platform:platform(),arch:arch()},command:'node scripts/experimental/p5-bracket-design-loop.mjs',transport:'real MCP stdio (scripts/studio-mcp.mjs)',
  synthetic:{geometry:`Built-in box ${WIDTH}x t x ${LENGTH} mm plate (synthetic stand-in for a bracket; not STEP, not SolidCraft)`,load:`${FORCE_N} N total force on tip face z=${LENGTH}, direction -y (synthetic, unconfirmed)`,support:'Fixed root face z=0',material:{catalogId:MATERIAL,catalogVersion:catalog.version,youngModulusPa:rows[0].saved.input.materialProperties.youngModulus,poissonRatio:POISSON,poissonOrigin:'user-assumption via applyCatalogMaterial (catalog has no Poisson ratio)'},
   target:`Max displacement <= ${TARGET_MM} mm (synthetic design target, unconfirmed)`,meshSizesMm:SIZES,intent:'exploratory; all provenance entries unconfirmed; results provisional'},
  toolsUsed:[...new Set(mcp.calls)],
  table:rows.map(({saved,solves,...r},i)=>({round:i<ROUND1.length?1:2,...r,solves:solves.map(({saved,...s})=>s),displacementRatioToBeam:r.finestMaxDisplacementMm/r.eulerBernoulliTipMm})),
  decision,comparison,
  missingApi:['Fused multi-box solid: boxes are independent unfused bodies, so ribs, gussets and L-shapes need contact; holes need a subtractive built-in or STEP edit','Design ID/version lineage operation (round linkage is recorded only in this evidence JSON)'],
  unverified:['Real bracket geometry, STEP exchange and SolidCraft design IDs/versions','Convergence beyond three Tet4 sizes (no Tet10 or Richardson extrapolation)','Common colour range and video output of the variants','User confirmation of material, Poisson ratio, load and deflection target']},null,1));
}finally{mcp.close();await rm(dir,{recursive:true,force:true});}
