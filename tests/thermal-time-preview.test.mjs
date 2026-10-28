import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installVisualExport} from '../src/visual-export.js';

// 79-VIEWTIME: the GUI Play preview replays stored thermal temperature frames through the shared slider.
class Vector{constructor(x=1,y=2,z=3){Object.assign(this,{x,y,z});}clone(){return new Vector(this.x,this.y,this.z);}copy(v){Object.assign(this,{x:v.x,y:v.y,z:v.z});return this;}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}applyAxisAngle(){return this;}}

function fixture({field='temperature',transient=true,snapshots=4,stopAfter}={}){
 const previous={document:globalThis.document,raf:globalThis.requestAnimationFrame,now:performance.now},elements=new Map(),slider=[],restored=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{id,disabled:false,value:'',checked:false,textContent:'',after(){},click(){},dispatchEvent(){}});return elements.get(id);};
 for(const id of ['result-legend','name','section-summary','visual-export-status','visual-export-download','result-surface','result-surface-wire','view-png','animation-kind','animation-seconds','animation-preview','animation-save','animation-gif-save','animation-stop','cancel-run','clip-axis','deform-scale','clip-enabled','clip-position','agent-disconnect','acoustic-time-frame','result-field'])element(id);
 element('cancel-run').disabled=true;element('clip-axis').value='0';element('deform-scale').value='2';element('clip-position').value='4';element('acoustic-time-frame').value='1';element('animation-kind').value='time';element('animation-seconds').value='1';element('result-field').value=field;
 element('acoustic-time-frame').dispatchEvent=()=>slider.push(Number(element('acoustic-time-frame').value));
 let clock=0,ticks=0;performance.now=()=>0;
 globalThis.requestAnimationFrame=cb=>setTimeout(()=>{ticks++;if(stopAfter&&ticks===stopAfter)element('animation-stop').onclick();cb(clock);clock+=250;},0);
 globalThis.document={getElementById:id=>elements.get(id)??null,createElement:tag=>tag==='canvas'?{width:0,height:0,getContext:()=>({fillRect(){},drawImage(){},fillText(){}})}:{innerHTML:''},querySelectorAll:()=>[element('animation-preview'),element('animation-save'),element('result-field')]};
 const output={mesh:{nodes:[0,0,0,1,1,1]},result:{kind:'thermal',transient,snapshots:Array.from({length:snapshots},(_,i)=>({time:i*5,temperature:[20+i,20+2*i]}))}};
 const camera={position:new Vector(),lookAt(){}},controls={target:new Vector(0,0,0),enabled:true,enableDamping:true};
 installVisualExport({renderer:{domElement:{width:320,height:200},render(){}},scene:{},camera,controls,getAnalysis:()=>output,redraw(){},language:()=>'en',translate(){},getTimeView:()=>({frameIndex:1,timeSeconds:6.25}),restoreTimeView:state=>restored.push(state)});
 const play=async()=>{element('animation-preview').onclick();for(let i=0;i<200&&!/Playback (completed|stopped)|cancelled|needs|requires|unavailable/.test(element('visual-export-status').textContent);i++)await new Promise(r=>setTimeout(r,1));return element('visual-export-status').textContent;};
 return {elements,slider,restored,controls,play,restore(){globalThis.document=previous.document;globalThis.requestAnimationFrame=previous.raf;performance.now=previous.now;}};
}

test('thermal Play preview steps stored temperature frames first to last and restores the interpolated view',async()=>{
 const f=fixture();try{
  assert.match(await f.play(),/Playback completed/);
  const played=f.slider.slice(0,-1);assert.equal(played[0],0);assert.equal(played.at(-1),3);for(let i=1;i<played.length;i++)assert.ok(played[i]>=played[i-1]);
  assert.deepEqual(f.restored,[{frameIndex:1,timeSeconds:6.25}]);assert.equal(f.controls.enabled,true);assert.equal(f.elements.get('animation-preview').disabled,false);assert.equal(f.elements.get('animation-stop').disabled,true);
 }finally{f.restore();}
});

test('thermal Play preview stop restores the displayed time and unlocks controls',async()=>{
 const f=fixture({stopAfter:2});try{
  assert.match(await f.play(),/Export cancelled/);assert.deepEqual(f.restored,[{frameIndex:1,timeSeconds:6.25}]);assert.equal(f.elements.get('animation-save').disabled,false);
 }finally{f.restore();}
});

test('thermal Play preview refuses heat flux, steady results and single-frame history before touching the slider',async()=>{
 for(const options of [{field:'heatFlux'},{transient:false},{snapshots:1}]){const f=fixture(options);try{
  assert.match(await f.play(),/needs stored temperature frames/);assert.deepEqual(f.slider,[]);assert.deepEqual(f.restored,[]);
 }finally{f.restore();}}
});
