import test from 'node:test';
import assert from 'node:assert/strict';
import {createViewCompareUi} from '../src/ui/view-compare-ui.js';

const fakeCtx = () => { const calls = []; return {calls, fillRect() {}, drawImage: (...a) => calls.push(['draw', ...a]), fillText: (t) => calls.push(['text', t]), createLinearGradient: () => ({addColorStop() {}}), set fillStyle(v) {}, set font(v) {}, set textAlign(v) {}}; };
function el(tag) { const e = {tag, children: [], textContent: '', value: '', style: {}, append(...c) { this.children.push(...c); }, replaceChildren(...c) { this.children = [...c]; }, setAttribute() {}, addEventListener() {}, after() {}, ctx: tag === 'canvas' ? fakeCtx() : null, getContext() { return this.ctx; }}; return e; }
function setup({transient = false, field = 'stress', finalOnly = false, presetApi,videoApi,env,language,onSettingsChanged} = {}) {
  const cases = [{name: 'A', output: {calculation: {options: {size: 5}}}}, {name: 'B', output: {calculation: {options: {size: 4}}}}];
  const renders = [], statuses = [], inspections = [];
  const ui = createViewCompareUi({
    presetApi,videoApi,env,language,onSettingsChanged, $: () => null, document: {createElement: el}, anchor: el('div'), status: t => statuses.push(t),
    store: {list: () => cases, compare: () => cases.map(() => ({metrics: [{key: 'maxVonMisesPa', value: 2e6, unit: 'Pa'}]}))},
    inspectCase: (i, selectedField) => { inspections.push([i, selectedField]); return {frameTimes: transient ? [0, 0.1, 0.2].map(t => t + i * 0.01) : null, fields: [field],finalOnly}; },
    renderCase: (i, spec) => { renders.push([i, spec]); return {canvas: {width: 100, height: 50}, min: i ? 1 : 0, max: i ? 20 : 10, unit: 'MPa', finalOnly}; },
    getField: () => field, getDeformScale: () => 25, getCamera: () => ({position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fov: 45})
  });
  return {ui, renders, statuses, cases, inspections};
}
test('final-only thermal fields are inspected by quantity and visibly exclude shared time', async () => {
  const {ui, renders, inspections} = setup({field: 'heatFlux', finalOnly: true});
  const plan = await ui.show();
  assert.ok(inspections.every(([i,field])=>(i===0||i===1)&&field==='heatFlux'));
  assert.ok(plan.panels.every(p => !p.time.timeApplies));
  assert.ok(renders.every(([, spec]) => spec.frameIndex === null));
  const canvas = ui.host.children.find(e => e.id === 'compare-canvas');
  const text = canvas.ctx.calls.filter(c => c[0] === 'text').map(c => c[1]).join('\n');
  assert.match(text, /最終ステップのみ/);
});
test('static pair is rendered twice per case: auto range first, then one shared fixed range and scale', async () => {
  const {ui, renders} = setup();
  const plan = await ui.show();
  assert.equal(renders.length, 4);
  assert.equal(renders[0][1].colorRange, null);
  const fixed = renders.slice(2).map(r => r[1]);
  assert.deepEqual(fixed[0].colorRange, {field: 'stress', minimum: 0, maximum: 20});
  assert.deepEqual(fixed[0], {...fixed[1]});
  assert.equal(fixed[0].deformScale, 25);
  assert.equal(plan.panels.length, 2);
});
test('transient pair needs a shared time and shows the offset to the stored frame', async () => {
  const {ui, renders} = setup({transient: true});
  await assert.rejects(ui.show(), /物理時刻/);
  assert.equal(renders.length, 0);
});
test('transient pair snaps each case to its nearest stored frame and draws the offsets', async () => {
  const {ui, renders} = setup({transient: true});
  const find = (n, id) => n.id === id ? n : n.children?.map?.(c => find(c, id)).find(Boolean);
  find(ui.host, 'compare-time').value = '0.1';
  const plan = await ui.show();
  assert.deepEqual(renders.slice(2).map(r => r[1].frameIndex), [1, 1]);
  assert.ok(Math.abs(plan.panels[1].time.offsetSeconds - 0.01) < 1e-12);
  const texts = find(ui.host, 'compare-canvas').ctx.calls.filter(c => c[0] === 'text').map(c => c[1]).join('\n');
  assert.match(texts, /保存フレームとのずれ/);
  assert.match(texts, /100 ms/);
  assert.match(texts, /\+10 ms/);
  assert.doesNotMatch(texts, /\d{8,}/);
});
test('colour bar: gradient fillRect per panel with min/max labels and unit; hint line present', async () => {
  const {ui} = setup();
  const find = (n, id) => n.id === id ? n : n.children?.map?.(c => find(c, id)).find(Boolean);
  assert.match(find(ui.host, 'compare-hint').textContent, /過渡/);
  await ui.show();
  const texts = find(ui.host, 'compare-canvas').ctx.calls.filter(c => c[0] === 'text').map(c => c[1]);
  assert.equal(texts.filter(t => t === '0 MPa').length, 2);
  assert.equal(texts.filter(t => t === '20 MPa').length, 2);
});

const find=(n,id)=>n.id===id?n:n.children?.map(c=>find(c,id)).find(Boolean);
const imported=()=>({indices:[1,0],settings:{field:'stress',deformScale:3,camera:{position:[2,3,6],target:[0,0,0],up:[0,1,0],fov:50}}});
test('portable settings apply without rendering or mutating main getters; capture is detached; reset uses viewer',async()=>{
 const f=setup();await f.ui.show();assert.equal(find(f.ui.host,'compare-png').disabled,false);const next=imported();f.ui.apply(next);assert.equal(f.renders.length,4);assert.equal(find(f.ui.host,'compare-png').disabled,true);assert.equal(find(f.ui.host,'compare-canvas').width,0);next.settings.camera.position[0]=99;assert.equal(f.ui.capture().settings.camera.position[0],2);const captured=f.ui.capture();captured.settings.deformScale=99;assert.equal(f.ui.capture().settings.deformScale,3);await f.ui.show();assert.equal(f.renders.at(-1)[1].deformScale,3);assert.deepEqual(f.renders.at(-1)[1].camera.position,[2,3,6]);find(f.ui.host,'compare-settings-reset').onclick();await f.ui.show();assert.equal(f.renders.at(-1)[1].deformScale,25);
});
test('invalid apply is atomic and preserves previous selection settings and PNG',async()=>{
 const f=setup();f.ui.apply(imported());await f.ui.show();const before=f.ui.capture();for(const mutate of [n=>n.indices=[0,0],n=>n.indices=[0,3],n=>n.settings.field='missing',n=>n.settings.camera.up=[0,0,0],n=>n.settings.timeSeconds=-1,n=>n.settings.toleranceSeconds=1]){const n=imported();mutate(n);assert.throws(()=>f.ui.apply(n));assert.deepEqual(f.ui.capture(),before);assert.equal(find(f.ui.host,'compare-png').disabled,false);}
});
test('imported time and tolerance select nearest stored frames without rendering during apply',async()=>{
 const f=setup({transient:true}),next=imported();next.settings.timeSeconds=.1;next.settings.toleranceSeconds=.02;f.ui.apply(next);assert.equal(f.renders.length,0);const plan=await f.ui.show();assert.deepEqual(plan.panels.map(p=>p.time.frameIndex),[1,1]);assert.deepEqual(f.ui.capture().settings.toleranceSeconds,.02);
});
test('JSON text and file imports use revision captured before async read and enforce size cap',async()=>{
 const calls=[];let revision='old',read;const presetApi={get:async()=>({revision,archive:{version:1}}),set:async command=>calls.push(command)},f=setup({presetApi});find(f.ui.host,'compare-settings-json').value='{"version":1}';await find(f.ui.host,'compare-settings-import').onclick();assert.deepEqual(calls[0],{archive:{version:1},expectedRevision:'old'});
 const file=find(f.ui.host,'compare-settings-file');file.files=[{size:2,text:()=>new Promise(resolve=>{read=resolve;})}];const pending=file.onchange();await Promise.resolve();revision='new';read('{"version":2}');await pending;assert.equal(calls[1].expectedRevision,'old');file.files=[{size:131073,text:()=>{throw Error('must not read');}}];await file.onchange();assert.equal(calls.length,2);assert.match(f.statuses.at(-1),/128 KiB/);await find(f.ui.host,'compare-settings-export').onclick();assert.equal(JSON.parse(find(f.ui.host,'compare-settings-json').value).version,1);
});

test('raw capture supports incomplete initial selections and no cases without mutating controls',()=>{
 const f=setup({transient:true});f.cases.length=0;const raw=f.ui.capture();assert.deepEqual(raw.indices,[0,1]);assert.equal(Object.hasOwn(raw.settings,'timeSeconds'),false);assert.doesNotThrow(()=>JSON.stringify(raw));assert.throws(()=>f.ui.capture({validate:true}));assert.equal(find(f.ui.host,'compare-left').children.length,0);
});
test('final-only thermal heat flux shared time is refused before settings mutation',()=>{
 const f=setup({field:'heatFlux',finalOnly:true}),before=f.ui.capture(),next=imported();next.settings.field='heatFlux';next.settings.timeSeconds=5;assert.throws(()=>f.ui.apply(next),/final-step only/);assert.deepEqual(f.ui.capture(),before);
});

function videoEnvironment(){const created=[],revoked=[];return {created,revoked,env:{URL:{createObjectURL:blob=>{const url='blob:comparison-'+created.length;created.push({blob,url});return url;},revokeObjectURL:url=>revoked.push(url)}}};}
const videoBlob=()=>new Blob(['webm'],{type:'video/webm;codecs=vp8'});

test('comparison video uses validated panel state/default two seconds and exposes preview plus explicit save only after success',async()=>{
 const urls=videoEnvironment(),calls=[],f=setup({videoApi:{capabilities:()=>({supported:true}),async start(state,options){calls.push({state,seconds:options.seconds});options.onProgress({fraction:.5});assert.match(find(f.ui.host,'compare-video-status').textContent,/50%/);return {blob:videoBlob(),metadata:{name:'clip.webm'}};},cancel(){}},env:urls.env});
 const start=find(f.ui.host,'compare-video-start'),preview=find(f.ui.host,'compare-video-preview'),download=find(f.ui.host,'compare-video-download');
 preview.play=()=>assert.fail('Preview must not autoplay');download.click=()=>assert.fail('Video must not automatically download');
 assert.equal(preview.hidden,true);assert.equal(download.hidden,true);assert.equal(preview.controls,true);assert.equal(find(f.ui.host,'compare-video-seconds').value,'2');
 await start.onclick();assert.equal(calls[0].seconds,2);assert.deepEqual(calls[0].state.indices,[0,1]);assert.equal(calls[0].state.settings.field,'stress');
 assert.equal(preview.hidden,false);assert.equal(download.hidden,false);assert.equal(preview.src,'blob:comparison-0');assert.equal(download.href,preview.src);assert.equal(download.download,'case-comparison-orbit.webm');assert.equal(start.disabled,false);
 await start.onclick();assert.deepEqual(urls.revoked,['blob:comparison-0']);assert.equal(preview.src,'blob:comparison-1');
});

test('video cancellation discards late successful promises and stale links; subsequent failure leaves no preview',async()=>{
 const urls=videoEnvironment();let finish,cancels=0,fail=false;
 const f=setup({videoApi:{capabilities:()=>({supported:true}),start:()=>fail?Promise.reject(Error('Recorder failed')):new Promise(resolve=>{finish=resolve;}),cancel(){cancels++;}},env:urls.env}),start=find(f.ui.host,'compare-video-start'),cancel=find(f.ui.host,'compare-video-cancel'),preview=find(f.ui.host,'compare-video-preview'),link=find(f.ui.host,'compare-video-download');
 const pending=start.onclick();assert.equal(start.disabled,true);assert.equal(cancel.disabled,false);await cancel.onclick();finish({blob:videoBlob()});await pending;
 assert.equal(cancels,1);assert.equal(urls.created.length,0);assert.equal(preview.hidden,true);assert.equal(link.hidden,true);assert.equal(link.href,'');assert.equal(cancel.disabled,true);assert.match(find(f.ui.host,'compare-video-status').textContent,/中止しました/);
 const success=start.onclick();finish({blob:videoBlob()});await success;assert.equal(preview.hidden,false);
 fail=true;await start.onclick();assert.deepEqual(urls.revoked,['blob:comparison-0']);assert.equal(preview.hidden,true);assert.equal(link.hidden,true);assert.equal(link.href,'');assert.match(find(f.ui.host,'compare-video-status').textContent,/Recorder failed/);
});

test('unsupported capability, invalid duration and missing transient time refuse without invoking video start',async()=>{
 const unsupported=setup({videoApi:{capabilities:()=>({supported:false,reason:'No WebM codec'}),start:()=>assert.fail('Unsupported start')}});
 assert.equal(find(unsupported.ui.host,'compare-video-start').disabled,true);assert.equal(find(unsupported.ui.host,'compare-video-status').textContent,'このブラウザでは比較動画を作成できません。');
 const english=setup({language:()=> 'en',videoApi:{capabilities:()=>({supported:false,reason:'Canvas captureStream is unavailable'})}});assert.equal(find(english.ui.host,'compare-video-status').textContent,'This browser cannot create comparison videos.');
 let calls=0;const videoApi={capabilities:()=>({supported:true}),start(){calls++;return Promise.resolve({blob:videoBlob()});},cancel(){}};
 const f=setup({videoApi});for(const value of ['0','16','1.5','']){find(f.ui.host,'compare-video-seconds').value=value;await find(f.ui.host,'compare-video-start').onclick();assert.equal(calls,0);assert.match(find(f.ui.host,'compare-video-status').textContent,/1〜15/);}
 const timed=setup({videoApi,transient:true});await find(timed.ui.host,'compare-video-start').onclick();assert.equal(calls,0);assert.match(find(timed.ui.host,'compare-video-status').textContent,/物理時刻/);
});

test('only successful comparison display or preset apply notifies automatic saving; failures remain nonfatal',async()=>{
 let notifications=0;const f=setup({onSettingsChanged:()=>{notifications++;return Promise.reject(Error('Storage unavailable'));}});
 await f.ui.show();assert.equal(notifications,1);f.ui.apply(imported());assert.equal(notifications,2);
 assert.throws(()=>f.ui.apply({...imported(),indices:[0,0]}));assert.equal(notifications,2);
});


test('GUI time video fixes camera, forwards explicit range and leaves current single-time panel untouched',async()=>{
 const calls=[],urls=videoEnvironment(),f=setup({transient:true,field:'temperature',videoApi:{capabilities:()=>({supported:true}),start:async(state,options)=>{calls.push({state,options});return {blob:videoBlob()};},cancel(){}},env:urls.env});const kind=find(f.ui.host,'compare-video-kind');kind.value='time';kind.onchange();find(f.ui.host,'compare-video-from').value='.01';find(f.ui.host,'compare-video-to').value='.2';find(f.ui.host,'compare-time').value='.12';const before=f.ui.capture();await find(f.ui.host,'compare-video-start').onclick();assert.equal(calls.length,1);assert.equal(calls[0].options.animation,'time');assert.equal(calls[0].options.startTimeSeconds,.01);assert.equal(calls[0].options.endTimeSeconds,.2);assert.equal(calls[0].state.settings.timeSeconds,undefined);assert.deepEqual(calls[0].state.settings.camera,before.settings.camera);assert.deepEqual(f.ui.capture(),before);assert.equal(find(f.ui.host,'compare-video-download').download,'case-comparison-time.webm');assert.equal(find(f.ui.host,'compare-video-from').disabled,false);
});

test('GUI time video rejects static/final-only fields and empty/nonoverlapping ranges before starting',async()=>{
 let calls=0;const api={capabilities:()=>({supported:true}),start:()=>{calls++;return Promise.resolve({blob:videoBlob()});},cancel(){}};for(const options of [{field:'stress'},{field:'heatFlux',finalOnly:true},{field:'temperature',transient:true}]){const f=setup({...options,videoApi:api});find(f.ui.host,'compare-video-kind').value='time';for(const [from,to]of [['',''],['1','0'],['0','.2']]){find(f.ui.host,'compare-video-from').value=from;find(f.ui.host,'compare-video-to').value=to;await find(f.ui.host,'compare-video-start').onclick();}}assert.equal(calls,0);
});


test('GUI time-video tolerance is explicit and does not inherit the single-time preset tolerance',async()=>{
 const calls=[],f=setup({field:'temperature',transient:true,videoApi:{capabilities:()=>({supported:true}),start:async(state)=>{calls.push(state);return {blob:videoBlob()};},cancel(){}},env:videoEnvironment().env}),saved=f.ui.capture();saved.settings.timeSeconds=.1;saved.settings.toleranceSeconds=.02;f.ui.apply(saved);find(f.ui.host,'compare-video-kind').value='time';find(f.ui.host,'compare-video-from').value='.01';find(f.ui.host,'compare-video-to').value='.2';await find(f.ui.host,'compare-video-start').onclick();assert.equal(calls.length,1);assert.equal(calls[0].settings.toleranceSeconds,undefined);assert.equal(f.ui.capture().settings.toleranceSeconds,.02);find(f.ui.host,'compare-video-tolerance').value='.05';await find(f.ui.host,'compare-video-start').onclick();assert.equal(calls[1].settings.toleranceSeconds,.05);assert.equal(f.ui.capture().settings.toleranceSeconds,.02);
});
