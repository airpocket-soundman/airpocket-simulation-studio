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
  []
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
  []
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
  [
   "acoustic-frequency",
   "acoustic-sweep"
  ],
  [],
  []
 ],
 [
  "channel-flow",
  [
   "channelFlow"
  ],
  [],
  []
 ],
 [
  "stokes",
  [
   "creepingFlow"
  ],
  [],
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
 }
];
const clone=value=>JSON.parse(JSON.stringify(value));
export function getObservationProfiles({target='browser'}={}){
 if(!['browser','node'].includes(target))throw Error('Unknown execution target');
 return definitions.filter(([id])=>target==='browser'||id!=='elastic-webgpu').map(([id,models,events,fields])=>({id,models,methods:id==='mesh'?[...cpuMethods,'mfem-wasm',...(target==='browser'?['webgpu-pcg']:[])]:id==='elastic-mfem'?['mfem-wasm']:id==='elastic-webgpu'?['webgpu-pcg']:[...cpuMethods],events:clone([...common,...events]),textProgress:true,fields:clone(fields),limitations:['Declaration of implemented observation paths only; not execution permission or physical validation','Events and retained artifacts are not guaranteed: failures, zero iterations, retention limits and cancellation may omit them',...(events.length?[]:['No structured numerical iteration events']),...(id==='acoustic-frequency'?['Frequency sweeps emit text progress, not structured frequency-step events']:[])]}));
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
 const profile=reasons.length?null:profiles.find(p=>p.id===id)??null,supported=!!profile,requested=options.includeFields===true,scalarFieldsSupported=supported&&profile.fields.length>0;
 return {schemaVersion:1,target,operation,supported,profileId:profile?.id??null,profile,reasons,adaptive:{enabled:options.adaptive===true,structuredRoundEvents:false,meshPerRound:supported&&operation==='solve'&&options.adaptive===true,textProgressOnly:supported&&operation==='solve'&&options.adaptive===true},fieldRetention:{requested,available:requested&&scalarFieldsSupported,scalarFieldsSupported,meshSupported:supported,meshAvailable:requested&&supported,maxBytes:64000000,eventRetention:256,availabilityIsGuarantee:false},declarationOnly:true,physicalAccuracyVerified:false};
}
