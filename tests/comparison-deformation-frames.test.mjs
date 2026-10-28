import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonExportAdapter} from '../src/comparison-export-adapter.js';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';
import {renderComparisonGif} from '../src/ui/comparison-gif.js';
import {createGifCanvasEnv} from './fixtures/comparison-acoustic-time-gif.mjs';

const camera={position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40},sha=i=>'sha256:'+String(i).repeat(64);
const elastic=()=>({mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},result:{kind:'elastic',displacement:[0,0,0,0,0,0,0,0,0,0,0,.01],magnitudes:[0,0,0,.01],vonMises:[1000000]}});
function fixture({format='gif',tamper}={}){
 const outputs=[elastic(),elastic()],renders=[];let releases=0;
 const adapter=createComparisonExportAdapter({cases:{readSource:async ref=>({caseId:ref.caseId,revision:ref.expectedRevision,name:ref.caseId,output:outputs[Number(ref.caseId)],assertCurrent(){}})},getDefaults:()=>({camera,deformScale:1}),renderComparison:args=>{renders.push(args);return {canvas:{width:1280,height:640},panels:[],colorRange:{field:'displacement',minimum:0,maximum:.01},unit:'mm'};},acquireHostLock:()=>({assertOwned(){},release(){releases++;}}),encodeGif:args=>renderComparisonGif(tamper?{...args,renderFrame:(c,f)=>args.renderFrame(c,{...f,phase:tamper(f.phase)})}:args,createGifCanvasEnv()),recordVideo:async args=>{for(let i=0;i<100;i++)args.renderFrame(camera,{phase:i/99});return new Blob([Uint8Array.of(26,69,223,163)],{type:'video/webm'});}});
 const queue=createVisualExportJobs({render:()=>{},prepareCompare:(...a)=>adapter.prepare(...a),renderCompare:a=>adapter.render(a)});
 const request={requestId:'deform-'+format,references:outputs.map((_,i)=>({caseId:String(i),expectedRevision:sha(i+1)})),field:'displacement',format,animation:'deformation',seconds:2,deformScale:20};
 return {outputs,renders,queue,request,get releases(){return releases;}};
}
async function complete(h){const job=await h.queue.startCompare(h.request);await h.queue.waitForSettled(job);return h.queue.status(job);}

test('deformation GIF manifest records the display multiplier drawn in each of the 24 encoded frames',async()=>{
 const h=fixture(),before=structuredClone(h.outputs),done=await complete(h);assert.equal(done.state,'completed',done.error);
 const ledger=done.artifact.manifest.time.deformationFrames,drawn=h.renders.slice(1);
 assert.equal(ledger.entries.length,24);assert.equal(drawn.length,24);assert.equal(ledger.endScale,20);assert.equal(ledger.scalePolicy,'linear');
 for(const [i,e] of ledger.entries.entries()){assert.equal(e.renderIndex,i);assert.equal(e.phase,i/23);assert.equal(e.deformScale,drawn[i].deformScale);}
 assert.equal(ledger.entries[0].deformScale,0);assert.equal(ledger.entries[23].deformScale,20);
 assert.equal(done.artifact.manifest.time.frameTimings,undefined);assert.deepEqual(h.outputs,before);assert.equal(h.releases,1);
 const exposed=h.queue.artifact({jobId:done.jobId,length:1});exposed.manifest.time.deformationFrames.entries[0].deformScale=999;
 assert.equal(h.queue.status(done).artifact.manifest.time.deformationFrames.entries[0].deformScale,0,'returned manifests cannot mutate the retained ledger');
});

test('a deformation GIF whose drawn phases differ from the linear plan is refused, not published',async()=>{
 const h=fixture({tamper:p=>p===1?1:p/2}),done=await complete(h);
 assert.equal(done.state,'failed');assert.match(done.error,/deformation frames/);assert.equal(done.artifact,undefined);assert.equal(h.releases,1);
});

test('deformation WebM keeps its real-time summary without a per-frame scale ledger',async()=>{
 const h=fixture({format:'webm'}),done=await complete(h);assert.equal(done.state,'completed',done.error);
 assert.equal(done.artifact.manifest.time?.deformationFrames,undefined);assert.equal(done.artifact.manifest.comparison.deformationAnimation.endScale,20);
});
