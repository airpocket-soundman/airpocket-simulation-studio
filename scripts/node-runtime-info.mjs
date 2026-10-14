/** Small runtime identity only. Never probes WASM, files, network or environment. */
export function inspectNodeRuntime(identity=process){
 const string=value=>typeof value==='string'&&value.length>0?value:null;
 const object=identity!==null&&(typeof identity==='object'||typeof identity==='function')?identity:null;
 const node=string(object?.version),v8=string(object?.versions?.v8),platform=string(object?.platform),arch=string(object?.arch);
 const observed=node==='v24.11.1'&&v8==='13.6.233.10-node.28'&&platform==='win32'&&arch==='x64';
 return {
  schemaVersion:1,kind:'node',node,v8,platform,arch,
  knownIssueAssessment:observed?'observed-risk':'not-assessed',
  diagnostics:observed?[{
   code:'NODE_WASM_ALLOCATION_FATAL_OBSERVED',severity:'warning',status:'unresolved',
   message:'A fatal V8 WASM allocation failure was observed for this exact runtime identity. This metadata does not predict whether an individual operation will fail.',
   evidence:['docs/evidence/2026-10-14-observation-profiles-v8-failure.json','docs/evidence/2026-10-15-wave-channel-node24-v8-failure.json'],
   suggestions:[
    'Inspect the recorded evidence and its limits.',
    'Consider the already verified browser path or an explicit runtime comparison.',
    'For headless jobs, explicitly selecting process isolation can contain a child exit without fixing V8.',
    'Do not automatically change the runtime or environment.'
   ]
  }]:[],
  compatibilityVerified:false,rootFixProven:false
 };
}
