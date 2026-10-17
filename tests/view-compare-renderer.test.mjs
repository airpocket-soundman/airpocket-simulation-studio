import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonRenderer} from '../src/view-compare-renderer.js';

function harness({units=['degC','degC'],times=[[0,5,10],[0,4,10]],failAt=0,finalOnly=false}={}){
 const sources=[{index:0},{index:1}],calls=[],texts=[];
 let displayed='original',canvases=0;
 const context={fillRect(){},drawImage(){},fillText:t=>texts.push(t),createLinearGradient:()=>({addColorStop(){}})};
 const renderer=createComparisonRenderer({
  inspectCase:(source,field)=>({fields:['temperature','heatFlux'],frameTimes:field==='heatFlux'?null:times[source.index]}),
  renderCase(source,settings){const previous=displayed;try{displayed=source.index;calls.push({source,settings});if(calls.length===failAt)throw Error('Renderer failed');return {canvas:{width:320,height:200},min:source.index?30:20,max:source.index?90:80,unit:units[source.index],finalOnly};}finally{displayed=previous;}},
  createCanvas(){canvases++;return {getContext:()=>context};},language:()=> 'en'
 });
 const request={cases:sources.map((source,i)=>({caseId:String(i),source,label:'Case '+i,conditions:[{name:'Mesh',value:i+1,unit:'mm'}]})),field:'temperature',deformScale:0,camera:{position:[1,2,3],target:[0,0,0],up:[0,1,0],fov:40},timeSeconds:4.7};
 return {renderer,request,calls,texts,get displayed(){return displayed;},get canvases(){return canvases;}};
}

test('explicit prepared sources share one camera/range and report actual selected thermal seconds',()=>{
 const h=harness(),before=structuredClone(h.request),out=h.renderer.render(h.request);
 assert.deepEqual(out.colorRange,{field:'temperature',minimum:20,maximum:90});
 assert.deepEqual(out.panels.map(p=>[p.frameIndex,p.timeSeconds]),[[1,5],[1,4]]);
 assert.ok(Math.abs(out.panels[0].offsetSeconds-.3)<1e-12);assert.ok(Math.abs(out.panels[1].offsetSeconds+.7)<1e-12);
 assert.equal(out.unit,'degC');assert.equal(out.canvas.width,1280);assert.equal(out.canvas.height,640);
 assert.ok(h.calls.every(c=>c.settings.camera===h.request.camera));
 assert.deepEqual(h.calls.slice(2).map(c=>c.settings.colorRange),[out.colorRange,out.colorRange]);
 assert.deepEqual(h.request,before);assert.equal(h.displayed,'original');
 assert.ok(h.texts.some(t=>t.includes('Physical time')));
 assert.ok(h.texts.some(t=>t.includes('Requested physical time')&&t.includes('4.7 s')));
});

test('explicit color range is applied consistently and unit mismatch refuses composition',()=>{
 const h=harness(),out=h.renderer.render({...h.request,colorRange:{field:'temperature',minimum:0,maximum:100,unit:'degC'}});
 assert.deepEqual(out.plan.colorRange,{field:'temperature',minimum:0,maximum:100});assert.equal(out.plan.rangePadded,false);
 const bad=harness({units:['degC','K']});assert.throws(()=>bad.renderer.render(bad.request),/different units/);assert.equal(bad.canvases,0);assert.equal(bad.displayed,'original');
 assert.throws(()=>h.renderer.render({...h.request,colorRange:{field:'temperature',minimum:2,maximum:1}}),/Invalid comparison color range/);
});

test('missing time, duplicate sources and tolerance fail before any viewer rendering',()=>{
 for(const change of [r=>delete r.timeSeconds,r=>r.cases[1].caseId='0',r=>r.toleranceSeconds=.01]){
  const h=harness();change(h.request);assert.throws(()=>h.renderer.render(h.request));assert.equal(h.calls.length,0);assert.equal(h.canvases,0);
 }
});

test('final-only fields have no thermal time axis and renderer errors preserve callback restoration',()=>{
 const h=harness({finalOnly:true}),out=h.renderer.render({...h.request,field:'heatFlux',timeSeconds:undefined});
 assert.ok(out.panels.every(p=>p.finalOnly&&!p.timeApplies&&p.frameIndex===null));
 assert.ok(h.texts.some(t=>t.includes('Final step only')));
 const failing=harness({failAt:3});assert.throws(()=>failing.renderer.render(failing.request),/Renderer failed/);
 assert.equal(failing.displayed,'original');assert.equal(failing.canvases,0);
});

test('visual deformation overlay explicitly distinguishes display amplification from loading history',()=>{
 const h=harness();h.renderer.render({...h.request,visualDeformation:true});assert.ok(h.texts.some(t=>t.includes('Visual deformation only; not a loading history')));
});
