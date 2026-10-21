// Reusable fixture for the transient-acoustic comparison time GIF (VIEWCOMPARE 04). It runs TWO real
// solveAcousticTransient cases on the minimal unit-tet air cavity already used by
// tests/acoustic-transient.test.mjs, identical except for the prescribed source amplitude in Pa.
// The export path uses the production comparison-export adapter, the comparison-time plan and the real
// GIF encoder; only the 2D canvas is a byte-level stub, so the emitted GIF bytes are encoder-produced.
import {solveAcousticTransient} from '../../src/acoustic-transient.js';
import {createComparisonExportAdapter} from '../../src/comparison-export-adapter.js';
import {renderComparisonGif} from '../../src/ui/comparison-gif.js';
import {createComparisonTimePlan} from '../../src/comparison-time-plan.js';

export const COMPARISON_CAMERA=Object.freeze({position:[2.4,1.8,2.6],target:[.25,.25,.25],up:[0,1,0],fov:40});
// Explicit fixture values (never guessed defaults): sound speed 343 m/s, air density 1.2 kg/m^3,
// 4 kHz carrier, 0.1 ms pulse width, 1.2 ms duration, 25 stored frames, unit-tet edge 1 mm.
export const ACOUSTIC_STUDY=Object.freeze({kind:'acoustic',acousticTransient:true,frequency:4000,soundSpeed:343,airDensity:1.2,lossFactor:0,pulseWidth:.0001,acousticDuration:.0012,receiverPoint:[.1,.1,.1],acousticSnapshotCount:25});
export const ACOUSTIC_MESH=Object.freeze({nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[]});
export const SOURCE_AMPLITUDES_PA=[1,2];

const freshMesh=()=>({nodes:[...ACOUSTIC_MESH.nodes],tetrahedra:ACOUSTIC_MESH.tetrahedra.map(t=>[...t]),surface:[]});

// Real solver output per amplitude. The prescribed pressure at node 0 is amplitude*pulse(t) Pa; the
// stored snapshots are the solver's own arrays and are never rewritten after the solve.
export function acousticTransientCases(){
 return SOURCE_AMPLITUDES_PA.map((amplitude,i)=>{
  const mesh=freshMesh(),result=solveAcousticTransient(mesh,{acousticPressures:[[0,amplitude]]},{...ACOUSTIC_STUDY});
  return {caseId:'acoustic-source-'+(i+1),revision:'fixture-acoustic-amplitude-'+amplitude+'Pa',name:'unit tet, prescribed '+amplitude+' Pa source',amplitude,output:{mesh,result}};
 });
}

// DOM-free destination canvas: the encoder reads real RGBA bytes, the 2D calls are ignored.
export function createGifCanvasEnv(){
 let reads=0;
 return {get reads(){return reads;},createCanvas:()=>({width:0,height:0,getContext:()=>({fillStyle:'',fillRect(){},drawImage(){},getImageData(){reads++;return {data:new Uint8ClampedArray(640*320*4)};}})}),yieldControl:async()=>{}};
}

export function createAcousticComparisonHarness({startTimeSeconds=0,endTimeSeconds=ACOUSTIC_STUDY.acousticDuration,toleranceSeconds,mutateCases}={}){
 const cases=acousticTransientCases();mutateCases?.(cases);
 const state={current:true,busy:false,locks:0,releases:0},renders=[],phases=[],env=createGifCanvasEnv();
 const adapter=createComparisonExportAdapter({
  cases:{readSource:async ref=>{const source=cases.find(c=>c.caseId===ref.caseId);if(!source)throw Error('Unknown comparison case');if(ref.expectedRevision!==undefined&&ref.expectedRevision!==source.revision)throw Error('Case content changed; list cases again');return {caseId:source.caseId,revision:source.revision,name:source.name,output:source.output,assertCurrent(){if(!state.current)throw Error('Case content changed; list cases again');}};}},
  getDefaults:()=>({camera:structuredClone(COMPARISON_CAMERA),deformScale:1}),
  isBusy:()=>state.busy,
  renderComparison:args=>{renders.push(args);return {canvas:{width:1280,height:640},panels:[],colorRange:args.colorRange,unit:'Pa'};},
  acquireHostLock:()=>{state.locks++;state.busy=true;return {assertOwned(){},release(){state.releases++;state.busy=false;}};},
  encodeGif:args=>renderComparisonGif({...args,renderFrame:(camera,frame)=>{phases.push(frame.phase);return args.renderFrame(camera,frame);}},env)
 });
 const request={requestId:'acoustic-time',format:'gif',animation:'time',field:'instantPressure',references:cases.map(c=>({caseId:c.caseId,expectedRevision:c.revision})),startTimeSeconds,endTimeSeconds,...(toleranceSeconds===undefined?{}:{toleranceSeconds})};
 return {cases,state,env,request,renders,phases,
  plan:()=>createComparisonTimePlan(cases.map(c=>c.output),{field:'instantPressure',startTimeSeconds,endTimeSeconds,...(toleranceSeconds===undefined?{}:{toleranceSeconds})}),
  prepare:overrides=>adapter.prepare(overrides?{...request,...overrides}:request),
  render:(prepared,overrides)=>adapter.render({...prepared,format:'gif',animation:'time',seconds:2,...overrides})};
}
