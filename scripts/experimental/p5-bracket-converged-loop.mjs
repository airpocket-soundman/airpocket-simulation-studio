// P5 third step: rerun the 97 synthetic plate-bracket design loop with a converged discretization. 97 showed every
// variant unconverged under Tet4 (max displacement still rising 14-45% between the two finest meshes): the PCG solves
// themselves converge (fem-core throws otherwise), so the cause is Tet4 bending locking on 1-4 elements through the
// thickness. Here each variant is created, configured, preflighted, meshed and Tet4-solved only through the real MCP
// stdio server exactly as in 97; the same MCP-written meshes are then re-solved in-process with the existing quadratic
// Tet10 element (src/tet10-elastic.js, straight-edged), and the decision rule runs on the Tet10 results. Same 5%
// convergence threshold and same synthetic, unconfirmed geometry/load/material/target as 97. Prints evidence JSON.
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir,platform,arch} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {tet10FromTet4,tet10UniformFaceForces,solveTet10Elastic} from '../../src/tet10-elastic.js';
const root=new URL('../../',import.meta.url),sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const WIDTH=20,LENGTH=60,ROUND1=[2,3,4],FORCE_N=10,MATERIAL='rtp-105-cc',POISSON=.35,SIZES=[2,1.4,1],TARGET_MM=1,CONVERGED=.05,EPS=1e-6;
const op=(method,...args)=>({method,args});
const read=(p,pointer)=>pointer.slice(1).split('/').reduce((v,key)=>v?.[key.replace(/~1/g,'/').replace(/~0/g,'~')],p);
function server(){
 const child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:root,stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let id=0,stderr='';child.stderr.on('data',v=>stderr=(stderr+v).slice(-4000));
 lines.on('line',line=>{const m=JSON.parse(line);pending.get(m.id)?.(m);});
 const request=(method,params,ms=300000)=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('MCP timeout '+method+' '+stderr));},ms);pending.set(key,m=>{clearTimeout(timer);pending.delete(key);resolve(m);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n');});
 const calls=[];
 return {calls,async call(name,args){calls.push(name);const r=(await request('tools/call',{name,arguments:args})).result;if(r?.isError)throw Error(name+': '+r.content?.[0]?.text);return r.structuredContent.value;},async init(){await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'p5-bracket-converged',version:'1'}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');},close(){child.kill();lines.close();}};
}
async function finished(mcp,jobId){const deadline=Date.now()+600000;while(Date.now()<deadline){const job=await mcp.call('studio_job_status',{jobId});if(['succeeded','failed','cancelled','timed_out'].includes(job.state))return job;await new Promise(r=>setTimeout(r,100));}throw Error('job timeout '+jobId);}
// Same support and load as the MCP project: root face z=0 fully fixed (corner and mid-edge nodes), 10 N in -y as a uniform traction on the tip face.
function tet10(saved,E){
 const mesh=tet10FromTet4({nodes:saved.mesh.nodes,tetrahedra:saved.mesh.tetrahedra}),displacements=[];
 for(let n=0;n<mesh.nodes.length/3;n++)if(Math.abs(mesh.nodes[3*n+2])<EPS)for(let k=0;k<3;k++)displacements.push({node:n,direction:[0,1,2].map(i=>i===k?1:0),valueMm:0});
 const load=tet10UniformFaceForces(mesh,(x,y,z)=>Math.abs(z-LENGTH)<EPS,[0,-FORCE_N,0]),started=performance.now(),r=solveTet10Elastic(mesh,{youngModulus:E,poissonRatio:POISSON},{displacements,forces:load.forces},{tolerance:1e-10,maxIterations:60000});
 let max=0;for(let n=0;n<r.displacement.length/3;n++)max=Math.max(max,Math.hypot(r.displacement[3*n],r.displacement[3*n+1],r.displacement[3*n+2]));
 return {nodeCount:mesh.nodes.length/3,loadedAreaMm2:load.areaMm2,loadedFaces:load.faceCount,fixedNodes:displacements.length/3,pcgIterations:r.iterations,pcgResidual:r.residual,seconds:+((performance.now()-started)/1000).toFixed(1),maxDisplacementMm:max};
}
async function variant(mcp,dir,catalog,t){
 const p=name=>join(dir,`t${t}-${name}.json`),solves=[];
 const created=await mcp.call('studio_create_builtin_project',{source:{kind:'box',bounds:[0,0,0,WIDTH,t,LENGTH]},outputPath:p('created'),name:`Synthetic plate bracket t=${t} mm`});
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
  const started=await mcp.call('studio_start_analysis',{path:p('ready'),outputPath:p(`result-${size}`),requestId:`p5-converged-t${t}-h${size}`,size,includeFields:true});
  const job=await finished(mcp,started.jobId);if(job.state!=='succeeded')throw Error('job '+job.state+' '+JSON.stringify(job.error));await mcp.call('studio_release_job',{jobId:started.jobId});
  const saved=JSON.parse(await readFile(job.result.outputPath,'utf8')),E=saved.input.materialProperties.youngModulus;
  solves.push({meshSizeMm:size,jobId:started.jobId,state:job.state,provisional:job.result.job.provisional,elementCount:saved.mesh.tetrahedra.length,tet4:{maxDisplacementMm:job.result.maxDisplacementMm},tet10:tet10(saved,E),youngModulusPa:E});
 }
 const E=solves[0].youngModulusPa,I=WIDTH*t**3/12*1e-12,L=LENGTH*1e-3,G=E/(2*(1+POISSON)),change=k=>Math.abs(solves[2][k].maxDisplacementMm-solves[1][k].maxDisplacementMm)/solves[2][k].maxDisplacementMm;
 const beam=FORCE_N*L**3/(3*E*I)*1e3,shear=FORCE_N*L/(5/6*G*WIDTH*t*1e-6)*1e3;
 return {thicknessMm:t,inputRevision:prov.revision,youngModulusPa:E,preflight:{allowed:ready.allowed,provisional:ready.provisional},solves:solves.map(({youngModulusPa,...s})=>s),
  convergence:{metric:'relative change of Tet10 max displacement between the two finest MCP meshes',change:change('tet10'),threshold:CONVERGED,converged:change('tet10')<CONVERGED,tet4ChangeSameMeshes:change('tet4')},
  finestMaxDisplacementMm:solves[2].tet10.maxDisplacementMm,eulerBernoulliTipMm:beam,timoshenkoTipMm:beam+shear,volumeMm3:WIDTH*t*LENGTH};
}
// Recorded decision rule (unchanged from 97): fit d=a*t^b on the finest results, choose the thinnest t (0.1 mm step) predicted
// to meet the target. Applied only when every round-1 input converged; otherwise the loop stops and says so.
function decide(rows){
 const unconverged=rows.filter(r=>!r.convergence.converged).map(r=>r.thicknessMm);if(unconverged.length)return {unconvergedInputs:unconverged,nextThicknessMm:null,rationale:'Decision withheld: unconverged inputs'};
 const x=rows.map(r=>Math.log(r.thicknessMm)),y=rows.map(r=>Math.log(r.finestMaxDisplacementMm)),n=x.length,mx=x.reduce((a,b)=>a+b)/n,my=y.reduce((a,b)=>a+b)/n;
 const b=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/x.reduce((s,v)=>s+(v-mx)**2,0),a=Math.exp(my-b*mx),exact=(TARGET_MM/a)**(1/b),next=Math.ceil(exact*10-1e-9)/10,meeting=rows.filter(r=>r.finestMaxDisplacementMm<=TARGET_MM).map(r=>r.thicknessMm);
 return {rule:`fit d=a*t^b on converged Tet10 finest-mesh max displacement; choose thinnest t (0.1 mm step) with predicted d <= ${TARGET_MM} mm`,fit:{a,b},exactThicknessMm:exact,nextThicknessMm:next,round1MeetingTarget:meeting,unconvergedInputs:[],
  rationale:`Round 1 thinnest passing variant is ${meeting.length?Math.min(...meeting)+' mm':'none'}; the converged fit predicts ${next} mm reaches the target.`};
}
const dir=await mkdtemp(join(tmpdir(),'p5-converged-')),mcp=server();
try{
 await mcp.init();const catalog=await mcp.call('studio_material_catalog',{id:MATERIAL}),rows=[];
 for(const t of ROUND1)rows.push(await variant(mcp,dir,catalog,t));
 const decision=decide(rows);
 if(decision.nextThicknessMm!==null){
  if(ROUND1.includes(decision.nextThicknessMm))throw Error('decision repeats a round-1 variant');
  const round2=await variant(mcp,dir,catalog,decision.nextThicknessMm);rows.push(round2);
  decision.outcome={thicknessMm:round2.thicknessMm,finestMaxDisplacementMm:round2.finestMaxDisplacementMm,predictedMm:decision.fit.a*round2.thicknessMm**decision.fit.b,meetsTarget:round2.finestMaxDisplacementMm<=TARGET_MM,converged:round2.convergence.converged,
   volumeSavingVsThinnestPassing:decision.round1MeetingTarget.length?1-round2.volumeMm3/(WIDTH*Math.min(...decision.round1MeetingTarget)*LENGTH):null};
  // Selection is adopted only if round 2 is itself converged and meets the target; otherwise the evidence says why not.
  decision.selection=decision.outcome.converged&&decision.outcome.meetsTarget?{thicknessMm:round2.thicknessMm,status:'selected (synthetic target, unconfirmed inputs)'}:{thicknessMm:null,status:decision.outcome.converged?'round-2 candidate misses target':'round-2 candidate unconverged'};
 }
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),script=await readFile(new URL(import.meta.url));
 console.log(JSON.stringify({schemaVersion:1,task:'98-P5',previous:'97-P5 (docs/evidence/2026-10-29-opencode-97-p5.json)',date:new Date().toISOString().slice(0,10),baseSha:git(['rev-parse','HEAD']),scriptHash:sha(script),
  tet10Hash:sha(await readFile(new URL('src/tet10-elastic.js',root))),serverHash:sha(await readFile(new URL('scripts/studio-mcp.mjs',root))),environment:{node:process.version,platform:platform(),arch:arch()},
  command:'node scripts/experimental/p5-bracket-converged-loop.mjs',transport:'real MCP stdio (scripts/studio-mcp.mjs) for project, preflight, meshing and Tet4; in-process Tet10 re-solve of the MCP-written meshes',
  diagnosis:{cause:'Tet4 bending locking (constant-strain tetrahedra, 1-4 elements through thickness)',ruledOut:['PCG non-convergence: fem-core pcg throws "Solver did not converge" unless residual < 1e-8, and every 97 job succeeded','Rigid-body modes: root face fully fixed; an unconstrained system throws in pcg','Further Tet4 refinement: h=1 already near the 30000-element limit']},
  synthetic:{geometry:`Built-in box ${WIDTH}x t x ${LENGTH} mm plate (synthetic stand-in for a bracket; not STEP)`,load:`${FORCE_N} N uniform traction on tip face z=${LENGTH}, -y (synthetic, unconfirmed)`,support:'Fixed root face z=0',material:{catalogId:MATERIAL,catalogVersion:catalog.version,poissonRatio:POISSON,poissonOrigin:'user-assumption'},target:`Max displacement <= ${TARGET_MM} mm (synthetic, unconfirmed)`,meshSizesMm:SIZES,convergenceThreshold:CONVERGED},
  toolsUsed:[...new Set(mcp.calls)],table:rows.map((r,i)=>({round:i<ROUND1.length?1:2,...r,displacementRatioToTimoshenko:r.finestMaxDisplacementMm/r.timoshenkoTipMm})),decision,
  missingApi:['Tet10 (quadratic) structural solve selectable through studio_start_analysis; here it runs in-process on MCP-written meshes','Fused multi-box / subtractive built-in shapes for ribs, L-shapes and holes (from 97)'],
  unverified:['Real bracket geometry, STEP exchange and design IDs','User confirmation of material, Poisson ratio, load and deflection target']},null,1));
}finally{mcp.close();await rm(dir,{recursive:true,force:true});}
