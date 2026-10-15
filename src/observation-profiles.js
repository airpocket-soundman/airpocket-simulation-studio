// Metadata only: deliberately imports no solver, CAD, WASM or browser runtime.
const cpuMethods=['pcg','pcg-strict','wasm-pcg'];
const definitions=[
 [
  "mesh",
  [
   "mesh"
  ],
  [],
  []
 ],
 [
  "elastic-cpu",
  [
   "linear-elastic",
   "orthotropic"
  ],
  [
   {
    "stage": "iteration",
    "solver": "pcg",
    "cadence": "first iteration, every 25 iterations, and tolerance crossing; zero iterations emit none",
    "metrics": [
     {
      "name": "residual",
      "unit": "dimensionless"
     },
     {
      "name": "tolerance",
      "unit": "dimensionless"
     }
    ]
   }
  ],
  []
 ],
 [
  "modal-cpu",
  [
   "modal"
  ],
  [
   {
    "stage": "iteration",
    "solver": "modal-subspace",
    "cadence": "each subspace iteration",
    "metrics": [
     {
      "name": "residuals",
      "unit": "dimensionless"
     },
     {
      "name": "tolerance",
      "unit": "dimensionless"
     }
    ]
   }
  ],
  []
 ],
 [
  "plasticity-cpu",
  [
   "plasticity"
  ],
  [
   {
    "stage": "load-step",
    "kind": "plasticity",
    "cadence": "each converged load step only",
    "metrics": [
     {
      "name": "loadFraction",
      "unit": "dimensionless"
     },
     {
      "name": "residual",
      "unit": "dimensionless"
     },
     {
      "name": "maxEquivalentPlasticStrain",
      "unit": "dimensionless"
     },
     {
      "name": "newtonIterations",
      "unit": "count"
     },
     {
      "name": "elasticEnergyJ",
      "unit": "J"
     },
     {
      "name": "hardeningEnergyJ",
      "unit": "J"
     },
     {
      "name": "plasticDissipationJ",
      "unit": "J"
     }
    ]
   }
  ],
  [{kind:'structuralDisplacement',name:'displacement',unit:'mm',valueType:'vector3',components:['x','y','z'],loadFactorUnit:'dimensionless',cadence:'each converged load step when includeFields is requested; load factor is not physical time'}]
 ],
 [
  "hyperelastic-cpu",
  [
   "hyperelastic"
  ],
  [
   {
    "stage": "load-step",
    "kind": "hyperelastic",
    "cadence": "each converged load step only",
    "metrics": [
     {
      "name": "loadFraction",
      "unit": "dimensionless"
     },
     {
      "name": "residual",
      "unit": "dimensionless"
     },
     {
      "name": "minJ",
      "unit": "dimensionless"
     },
     {
      "name": "newtonIterations",
      "unit": "count"
     },
     {
      "name": "energyJ",
      "unit": "J"
     }
    ]
   }
  ],
  [{kind:'structuralDisplacement',name:'displacement',unit:'mm',valueType:'vector3',components:['x','y','z'],loadFactorUnit:'dimensionless',cadence:'each converged load step when includeFields is requested; load factor is not physical time'}]
 ],
 [
  "thermal-steady",
  [
   "thermal-steady"
  ],
  [
   {
    "stage": "time-step",
    "kind": "thermal",
    "cadence": "one solved step at time 0",
    "metrics": [
     {
      "name": "minTemperature",
      "unit": "degC"
     },
     {
      "name": "maxTemperature",
      "unit": "degC"
     },
     {
      "name": "time",
      "unit": "s"
     },
     {
      "name": "storedEnergyJ",
      "unit": "J"
     },
     {
      "name": "radiationHeatW",
      "unit": "W"
     },
     {
      "name": "convectionHeatW",
      "unit": "W"
     },
     {
      "name": "nonlinearIterations",
      "unit": "count"
     },
     {
      "name": "residual",
      "unit": "dimensionless"
     }
    ]
   }
  ],
  [
   {
    "kind": "thermal",
    "name": "temperature",
    "unit": "degC",
    "timeUnit": "s",
    "cadence": "one solved step at time 0"
   }
  ]
 ],
 [
  "thermal-transient",
  [
   "thermal-transient"
  ],
  [
   {
    "stage": "time-step",
    "kind": "thermal",
    "cadence": "each solved time step, excluding initial state",
    "metrics": [
     {
      "name": "minTemperature",
      "unit": "degC"
     },
     {
      "name": "maxTemperature",
      "unit": "degC"
     },
     {
      "name": "time",
      "unit": "s"
     },
     {
      "name": "storedEnergyJ",
      "unit": "J"
     },
     {
      "name": "radiationHeatW",
      "unit": "W"
     },
     {
      "name": "convectionHeatW",
      "unit": "W"
     },
     {
      "name": "nonlinearIterations",
      "unit": "count"
     },
     {
      "name": "residual",
      "unit": "dimensionless"
     }
    ]
   }
  ],
  [
   {
    "kind": "thermal",
    "name": "temperature",
    "unit": "degC",
    "timeUnit": "s",
    "cadence": "each solved time step, excluding initial state"
   }
  ]
 ],
 [
  "acoustic-transient",
  [
   "acousticTransient"
  ],
  [
   {
    "stage": "time-step",
    "kind": "acousticTransient",
    "cadence": "every max(1,ceil(steps/60)) steps and final step; excludes initial state",
    "metrics": [
     {
      "name": "receiverPressurePa",
      "unit": "Pa"
     },
     {
      "name": "maxPressurePa",
      "unit": "Pa"
     }
    ]
   }
  ],
  [
   {
    "kind": "acousticTransient",
    "name": "pressure",
    "unit": "Pa",
    "timeUnit": "s",
    "cadence": "every max(1,ceil(steps/60)) steps and final step; excludes initial state"
   }
  ]
 ],
 [
  "acoustic-frequency",
  ["acoustic-frequency","acoustic-sweep"],
  [
   {stage:'iteration',solver:'bicgstab',kind:'acoustic',residualKind:'recurrence-relative',phases:['s-check','r-check','zero-rhs'],solvePhases:['single','sweep'],cadence:'first iteration, every 25 iterations, convergence and iteration limit; zero RHS emits iteration zero',metrics:[{name:'residual',unit:'dimensionless'},{name:'tolerance',unit:'dimensionless'},{name:'frequencyHz',unit:'Hz'}],residualBasis:'recursive residual norm divided by eliminated right-hand-side norm; no independent true-residual recalculation'},
   {stage:'frequency-step',solver:'acoustic-sweep',kind:'acoustic',when:'frequency-sweep',phases:['start','complete'],cadence:'start and complete of each requested sweep frequency; iteration events carry solvePhase sweep and step/steps',metrics:[{name:'frequencyHz',unit:'Hz'},{name:'residual',unit:'dimensionless'},{name:'iterations',unit:'count'},{name:'peakPressurePa',unit:'Pa'},{name:'splDb',unit:'dB'}],completeMetricsOnly:['residual','iterations','peakPressurePa','splDb']}
  ],
  []
 ],
 [
  "channel-flow",
  ["channelFlow"],
  [{stage:'iteration',solver:'pcg',kind:'channelFlow',residualKind:'recurrence-relative',cadence:'first iteration, every 25 iterations, and tolerance crossing; zero RHS emits none',metrics:[{name:'residual',unit:'dimensionless'},{name:'tolerance',unit:'dimensionless'}],residualBasis:'recursive residual norm divided by eliminated right-hand-side norm; no independent true-residual recalculation'}],
  []
 ],
 [
  "stokes",
  [
   "creepingFlow"
  ],
  [
   {stage:'iteration',solver:'stokes-gmres',velocityElements:['P1','P2'],phase:'restart-check',residualKind:'preconditioned-relative',cadence:'each GMRES restart check including iteration zero; skipped for zero right-hand side',metrics:[{name:'residual',unit:'dimensionless'},{name:'tolerance',unit:'dimensionless'}],residualBasis:'equilibrated, left-ILU(0)-preconditioned reduced system'},
   {stage:'iteration',solver:'stokes-gmres',velocityElements:['P1','P2'],phase:'arnoldi-estimate',residualKind:'preconditioned-relative-estimate',cadence:'iteration 1, each multiple of 10 iterations, and inner-loop termination',metrics:[{name:'residual',unit:'dimensionless'},{name:'tolerance',unit:'dimensionless'}],residualBasis:'Givens/Arnoldi estimate for the equilibrated, left-ILU(0)-preconditioned reduced system'},
   {stage:'iteration',solver:'stokes-gmres',velocityElements:['P1','P2'],phase:'final-check',residualKind:'true-relative',cadence:'once after the final original-system residual passes; iteration zero is possible',metrics:[{name:'residual',unit:'dimensionless'},{name:'tolerance',unit:'dimensionless'}],residualBasis:'original nondimensional full-system free-equation residual divided by the norm of raw reduced right-hand side'}
  ],
  []
 ],
 [
  "elastic-mfem",
  [
   "linear-elastic"
  ],
  [],
  []
 ],
 [
  "elastic-webgpu",
  [
   "linear-elastic"
  ],
  [],
  []
 ]
];
const common=[
 {
  "stage": "preparation",
  "cadence": "after module initialization",
  "metrics": []
 },
 {
  "stage": "mesh",
  "cadence": "after each generated mesh",
  "metrics": [
   {
    "name": "nodeCount",
    "unit": "count"
   },
   {
    "name": "elementCount",
    "unit": "count"
   },
   {
    "name": "volumeMm3",
    "unit": "mm^3"
   },
   {
    "name": "minVolumeMm3",
    "unit": "mm^3"
   },
   {
    "name": "minQuality",
    "unit": "dimensionless"
   },
   {
    "name": "qualityHistogram",
    "unit": "count"
   }
  ]
 },
 {
  "stage": "progress",
  "cadence": "worker text progress converted by the client",
  "metrics": []
 },
 {stage:'observation-transport',when:'protocol-enabled worker observation delivery',optional:true,provisional:true,scope:'worker observation events only; enabled by browser and headless job clients, not legacy direct worker calls',requiredFields:['observationTransport.maxEvents','observationTransport.maxBytes','observationTransport.maxOutboxEvents','observationTransport.maxOutboxBytes','observationTransport.maxTotalEvents','observationTransport.maxTotalBytes','observationTransport.terminalControlMaxEvents','observationTransport.terminalControlMaxBytes','observationTransport.pendingEvents','observationTransport.pendingBytes','observationTransport.outboxEvents','observationTransport.outboxBytes','observationTransport.peakEvents','observationTransport.peakBytes','observationTransport.outboxPeakEvents','observationTransport.outboxPeakBytes','observationTransport.accepted','observationTransport.dropped','observationTransport.droppedMeshes','observationTransport.droppedFields','observationTransport.sourceSequence','observationTransport.policy','observationTransport.scope','observationTransport.terminal'],terminalRequiredFields:['observationTransport.droppedReasons'],dataEnvelopeSequenceField:'observationTransport.sequence',dataEnvelopeAckField:'observationAckId',cadence:'bounded FIFO outbox coalesces scalar iterations; one bounded control summary after drain immediately before normal result or reported-error terminal delivery',terminalSummaryOnHardTermination:false,terminalSummaryAvailableOn:'normal-result-or-reported-error',hardTerminationKinds:['cancellation','timeout','worker-abnormal-exit'],missingTerminalSummaryMeans:'final transport drop totals unknown; never infer zero from the last observation snapshot',metrics:[{name:'observationTransport.pendingEvents',unit:'count'},{name:'observationTransport.pendingBytes',unit:'bytes'},{name:'observationTransport.outboxEvents',unit:'count'},{name:'observationTransport.outboxBytes',unit:'bytes'},{name:'observationTransport.dropped',unit:'count'}],maxEvents:8,maxBytes:8000000,maxOutboxEvents:8,maxOutboxBytes:8000000,maxTotalEvents:16,maxTotalBytes:16000000,terminalControlMaxEvents:1,terminalControlMaxBytes:4096,byteBasis:'conservative-structural-envelope-estimate-including-transport-metadata',policy:'non-blocking-solver-callbacks; enqueue/coalesce within bounded outbox; ACK pumps FIFO; drain before normal terminal',workerTransportBounded:true,boundedOnlyWhenProtocolEnabled:true,hostQueueBudgetSeparate:true,progressBounded:false,finalResultBounded:false,totalJavaScriptHeapBounded:false},
 {stage:'observation-queue-limit',when:'pending-payload-limit',optional:true,provisional:true,pendingBasis:'in-flight-and-queued-full-payloads',byteBasis:'conservative-structural-estimate',storageBudgetSeparate:true,workerTransportBounded:false,requiredFields:['observationQueue.reason','observationQueue.observationSequence','observationQueue.maxEvents','observationQueue.maxBytes','observationQueue.pendingEvents','observationQueue.pendingBytes','observationQueue.dropped','observationQueue.latestPolicy'],cadence:'host notification when a full mesh or field payload is omitted by the bounded pending queue; scalar summaries continue with source observationSequence',metrics:[{name:'observationQueue.dropped',unit:'count'},{name:'observationQueue.droppedMeshes',unit:'count'},{name:'observationQueue.droppedFields',unit:'count'},{name:'observationQueue.pendingEvents',unit:'count'},{name:'observationQueue.pendingBytes',unit:'bytes'}],latestPolicy:'last-accepted-snapshot',acceptedIsStored:false},
 {stage:'observation-event-gap',when:'job-event-payload-omission',optional:true,provisional:true,payloadOmitted:true,requiredFields:['gap.reason'],gapReasons:['bytes','structure-limit','non-finite','cycle','accessor','unsupported-type'],cadence:'replaces an unsafe or oversized observation at the same authoritative event sequence/type in the shared job registry; does not change calculation outcome',metrics:[],byteBasis:'serialized-UTF-8-JSON',workerTransportBounded:false,limitations:['Separate from pending field queue omissions and retained artifact limits.','A gap is missing telemetry, not evidence of convergence, failure or physical accuracy.','Event count and byte retention may evict older gaps; use the returned cursor and truncation metadata.']}
];
const clone=value=>JSON.parse(JSON.stringify(value));
export function getObservationProfiles({target='browser'}={}){
 if(!['browser','node'].includes(target))throw Error('Unknown execution target');
 return definitions.filter(([id])=>target==='browser'||id!=='elastic-webgpu').map(([id,models,events,fields])=>({id,models,methods:id==='mesh'?[...cpuMethods,'mfem-wasm',...(target==='browser'?['webgpu-pcg']:[])]:id==='elastic-mfem'?['mfem-wasm']:id==='elastic-webgpu'?['webgpu-pcg']:[...cpuMethods],events:clone([...common,{stage:'diagnostic',when:'execution-failure',cadence:'on caught Worker execution failure before its terminal error when observation is requested',metrics:[],failureSchemaVersion:1},...events]),textProgress:true,fields:clone(fields),limitations:['Declaration of implemented observation paths only; not execution permission or physical validation','Events and retained artifacts are not guaranteed: failures, zero iterations, retention limits and cancellation may omit them',...(events.length?[]:['No structured numerical iteration events']),...(['acoustic-frequency','channel-flow'].includes(id)?['Recurrence residual convergence is not an independent true-residual check or physical accuracy guarantee','Later checks may fail after numerical convergence; no intermediate pressure or velocity fields are retained']:[]),...(id==='stokes'?['Arnoldi estimates and restart residuals use a preconditioned system; only final-check reports the checked original-system relative residual','A converged numerical residual does not establish physical accuracy, flow balance or mesh independence','No intermediate Stokes velocity or pressure field arrays are retained']:[])]}));
}
export function resolveObservationProfile(project,options={},target='browser',operation='solve'){
 const profiles=getObservationProfiles({target});
 if(!['solve','mesh'].includes(operation))throw Error('Unknown observation operation');
 if(!options||typeof options!=='object'||Array.isArray(options))throw Error('Invalid observation options');
 const study=project?.study??{},material=project?.materialProperties??{},kind=study.kind??'structural',method=options.method??'wasm-pcg',reasons=[];
 const fail=(code,message)=>reasons.push({code,message});
 if(options.method!==undefined&&typeof options.method!=='string')fail('OPTION_INVALID','Invalid method option');
 if(![...cpuMethods,'mfem-wasm',...(target==='browser'?['webgpu-pcg']:[])].includes(method))fail('METHOD_UNSUPPORTED','Method is unavailable for this target');
 for(const key of ['adaptive','includeFields','transient'])if(options[key]!==undefined&&typeof options[key]!=='boolean')fail('OPTION_INVALID','Invalid boolean option: '+key);
 if(!['structural','thermal','acoustic','channelFlow','creepingFlow','fluidDomain'].includes(kind))fail('STUDY_UNSUPPORTED','Unknown study kind');
 for(const key of ['modalAnalysis','acousticTransient','transient'])if(study[key]!==undefined&&typeof study[key]!=='boolean')fail('STUDY_OPTION_INVALID','Invalid boolean study option: '+key);
 if(options.adaptive&&(kind!=='structural'||project?.sourceModel?.kind==='stl'))fail('ADAPTIVE_UNSUPPORTED','Adaptive refinement requires structural CAD input');
 if(operation==='solve'&&['mfem-wasm','webgpu-pcg'].includes(method)&&kind!=='structural')fail('METHOD_STUDY_UNSUPPORTED','Method supports structural studies only');
 let id='mesh';
 if(operation==='solve'){
  if(kind==='fluidDomain')fail('MESH_ONLY','Fluid domain preparation has no general flow solver');
  if(kind==='structural'){
   const models=['orthotropic','plasticity','hyperelastic'].filter(key=>material[key]);
   if(models.length>1)fail('MATERIAL_COMBINATION_UNSUPPORTED','Multiple constitutive models cannot share an observation declaration');
   if(models.length&&(!cpuMethods.includes(method)||study.thermalStress||study.modalAnalysis))fail('MATERIAL_COMBINATION_UNSUPPORTED','Constitutive model requires supported CPU structural configuration');
   if((material.plasticity||material.hyperelastic)&&options.adaptive)fail('ADAPTIVE_UNSUPPORTED','Nonlinear adaptive analysis is unsupported');
   if(material.hyperelastic&&Array.isArray(project?.conditions)&&project.conditions.some(c=>['pressure','normalTraction'].includes(c?.type)))fail('HYPERELASTIC_UNSUPPORTED','Follower pressure and normal traction are unsupported');
   if(study.modalAnalysis&&(options.adaptive||study.thermalStress||!cpuMethods.includes(method)))fail('MODAL_UNSUPPORTED','Modal configuration is unsupported');
   if(study.modalAnalysis&&study.gravityEnabled!==false&&Array.isArray(study.gravity)&&study.gravity.some(v=>v!==0))fail('MODAL_UNSUPPORTED','Modal gravity loading is unsupported');
   id=study.modalAnalysis?'modal-cpu':material.plasticity?'plasticity-cpu':material.hyperelastic?'hyperelastic-cpu':method==='mfem-wasm'?'elastic-mfem':method==='webgpu-pcg'?'elastic-webgpu':'elastic-cpu';
  }else if(kind==='thermal')id=(options.transient??study.transient)?'thermal-transient':'thermal-steady';
  else if(kind==='acoustic'){
   if(study.acousticTransient&&(study.sweep||study.directivityEnabled||study.lossFactor!==undefined&&study.lossFactor!==0))fail('ACOUSTIC_TRANSIENT_UNSUPPORTED','Transient acoustics excludes harmonic sweep, far field and harmonic loss');
   id=study.acousticTransient?'acoustic-transient':'acoustic-frequency';
  }else if(kind==='channelFlow')id='channel-flow';
  else if(kind==='creepingFlow')id='stokes';
 }
 const profile=reasons.length?null:profiles.find(p=>p.id===id)??null,supported=!!profile,requested=options.includeFields===true,scalarFieldsSupported=supported&&profile.fields.some(field=>field.valueType!=='vector3'),vectorFieldsSupported=supported&&profile.fields.some(field=>field.valueType==='vector3');
 return {schemaVersion:1,target,operation,supported,profileId:profile?.id??null,profile,reasons,adaptive:{enabled:options.adaptive===true,structuredRoundEvents:false,meshPerRound:supported&&operation==='solve'&&options.adaptive===true,textProgressOnly:supported&&operation==='solve'&&options.adaptive===true},fieldRetention:{requested,available:requested&&(scalarFieldsSupported||vectorFieldsSupported),scalarFieldsSupported,vectorFieldsSupported,meshSupported:supported,meshAvailable:requested&&supported,maxBytes:64000000,eventRetention:256,availabilityIsGuarantee:false},declarationOnly:true,physicalAccuracyVerified:false};
}
