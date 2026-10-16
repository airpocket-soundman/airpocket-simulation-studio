import {FIXED_FRAME_LIMITS,FIXED_FRAME_ANIMATIONS,validateFrameCount,fixedFrameSchedule,buildStoreZip,sha256Hex,pickViewFields,orbitCameraPosition} from './visual-export-fixed-frame.js';
// Capture the rendered view without changing the archived analysis fields.
export function animationState(kind,phase,{scale=1,frames=1,min=0,max=1}={}){
 if(!['orbit','deformation','time','slice'].includes(kind)||!Number.isFinite(phase)||phase<0||phase>1||!Number.isFinite(scale)||scale<0||!Number.isInteger(frames)||frames<1||!Number.isFinite(min)||!Number.isFinite(max)||max<min)throw Error('Invalid animation settings');
 return {angle:phase*2*Math.PI,deformScale:scale*(1-Math.cos(phase*2*Math.PI))/2,frame:Math.min(frames-1,Math.floor(phase*frames)),position:min+(max-min)*phase};
}

// A WebM with a header but no Matroska Cluster (ID 1F 43 B6 75) has no video frames and is unusable.
export async function hasVideoFrames(blob){
 if(!blob||blob.size<=0)return false;
 const bytes=new Uint8Array(await blob.arrayBuffer());
 for(let i=0;i+3<bytes.length;i++)if(bytes[i]===0x1f&&bytes[i+1]===0x43&&bytes[i+2]===0xb6&&bytes[i+3]===0x75)return true;
 return false;
}

const WEBM_TYPES=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
const MP4_TYPES=['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/mp4'];
function safeSupported(recorder,type){try{return typeof recorder?.isTypeSupported==='function'&&recorder.isTypeSupported(type)===true;}catch{return false;}}
// MP4 and GIF are never exported by this application. The MediaRecorder probe only explains why MP4 is refused;
// it can never make `supported` true because no MP4 encoder or muxer path exists here.
export function exportFormatCapabilities({mediaRecorder}={}){
 const mp4Type=MP4_TYPES.find(type=>safeSupported(mediaRecorder,type)),alternatives=['webm','png'];
 return {
  mp4:{supported:false,browserRecorderSupport:!!mp4Type,...(mp4Type?{probedMimeType:mp4Type}:{}),reason:mp4Type?'MediaRecorder reports MP4 recording in this browser, but MP4 export is not implemented in this application':'MediaRecorder does not support the MP4 container in this browser',alternatives:[...alternatives]},
  gif:{supported:false,reason:'GIF encoding is not implemented',alternatives:[...alternatives]}
 };
}

export function installVisualExport({renderer,scene,camera,controls,getAnalysis,redraw,language,translate}){
 const $=id=>document.getElementById(id),host=document.createElement('details');
 host.innerHTML=`<summary>画像・アニメーションを保存</summary><label><input id="result-surface" type="checkbox" checked> 結果の表面を表示</label><label><input id="result-surface-wire" type="checkbox"> 結果の表面メッシュを表示</label><button id="view-png">表示中の画像をPNGで保存</button><label>アニメーションの種類<select id="animation-kind"><option value="orbit">モデルを一周</option><option value="deformation">変形を往復（表示用）</option><option value="time">過渡音響の時間変化</option><option value="slice">断面を移動</option></select></label><label>動画の長さ（秒）<input id="animation-seconds" type="number" value="4" min="1" max="15" step="1"></label><div class="row"><button id="animation-preview">再生</button><button id="animation-save">WebM動画で保存</button><button id="animation-stop" disabled>再生を止める</button></div><p>画像・動画には現在の色、単位、メッシュ、断面を含めます。変形の往復は表示用で、載荷履歴の再計算ではありません。時間変化は保存した過渡音響フレームを使い、動画時間は表示用に伸縮します。</p><p id="visual-export-status" role="status"></p><a id="visual-export-download" hidden></a>`;
 $('result-legend').after(host);
 translate({'画像・アニメーションを保存':'Save images and animations','結果の表面を表示':'Show result surface','結果の表面メッシュを表示':'Show result surface mesh','表示中の画像をPNGで保存':'Save current view as PNG','アニメーションの種類':'Animation type','モデルを一周':'Orbit the model','変形を往復（表示用）':'Deformation cycle (visualization)','過渡音響の時間変化':'Transient acoustic time frames','断面を移動':'Move section plane','動画の長さ（秒）':'Video duration (seconds)','再生':'Play','WebM動画で保存':'Save WebM video','再生を止める':'Stop playback','画像・動画には現在の色、単位、メッシュ、断面を含めます。変形の往復は表示用で、載荷履歴の再計算ではありません。時間変化は保存した過渡音響フレームを使い、動画時間は表示用に伸縮します。':'Images and videos include current colors, units, mesh and sections. Deformation cycles are visualizations, not recalculated load histories. Time playback uses stored acoustic frames with a visualization time scale.'});
 $('result-surface').onchange=redraw;$('result-surface-wire').onchange=redraw;
 let active=null,downloadUrl;
 const message=(ja,en)=>$('visual-export-status').textContent=language()==='en'?en:ja;
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
 function capture(){
  renderer.render(scene,camera);const source=renderer.domElement,w=Math.min(1920,source.width),h=Math.max(1,Math.round(source.height*w/source.width));
  if(canvas.width!==w||canvas.height!==h+116){canvas.width=w;canvas.height=h+116;}
  context.fillStyle='#102331';context.fillRect(0,0,w,h+116);context.drawImage(source,0,0,w,h);
  context.fillStyle='#edf6f8';context.font='15px sans-serif';
  const lines=['airpocket Simulation Studio · '+$('name').textContent,(getAnalysis()?.result?.analysisAssessment?.provisional?(language()==='en'?'PROVISIONAL · ':'暫定解析 · '):'')+$('result-legend').textContent,$('section-summary').textContent,$('visual-export-status').textContent];
  lines.forEach((text,i)=>context.fillText(text,16,h+23+23*i,w-32));return canvas;
 }
 function download(blob,name){if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(blob);const link=$('visual-export-download');link.href=downloadUrl;link.download=name;link.textContent=language()==='en'?'Download again':'もう一度ダウンロード';link.hidden=false;link.click();}
 const stop=()=>{if(active)active.stop=true;};$('animation-stop').onclick=stop;
 $('view-png').onclick=()=>{try{message('表示中の画像','Current view');capture().toBlob(blob=>{if(blob)download(blob,'simulation-view.png');else message('画像を作成できませんでした。','Image capture failed.');},'image/png');}catch(error){message(error.message,error.message);}};
 async function animate(record,{animation,seconds:requestedSeconds,signal,onProgress=()=>{},save=true}={}){
  if(active)throw Error(language()==='en'?'Playback is already active.':'再生中です。');
  if(!$('cancel-run').disabled)throw Error(language()==='en'?'Wait for analysis to finish.':'解析の完了を待ってください。');
  const kind=animation??$('animation-kind').value,seconds=requestedSeconds??Number($('animation-seconds').value),output=getAnalysis(),result=output?.result;
  if(signal?.aborted)throw Error('Export cancelled');
  if(!['orbit','deformation','time','slice'].includes(kind))throw Error('Invalid animation type');
  if(!Number.isInteger(seconds)||seconds<1||seconds>15)throw Error(language()==='en'?'Duration must be 1–15 seconds.':'長さは1～15秒で指定してください。');
  if(kind==='deformation'&&!['elastic','modal'].includes(result?.kind))throw Error(language()==='en'?'Deformation requires a structural or modal result.':'変形には構造または固有振動の結果が必要です。');
  const time=$('acoustic-time-frame');
  if(kind==='time'&&(result?.kind!=='acousticTransient'||!time))throw Error(language()==='en'?'Time playback requires transient acoustic frames.':'時間変化には過渡音響の結果が必要です。');
  if(kind==='slice'&&!output?.mesh)throw Error(language()==='en'?'Generate a volume mesh first.':'先に体積メッシュを生成してください。');
  const mime=WEBM_TYPES.find(type=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(type));
  if(record&&(!mime||!canvas.captureStream))throw Error(language()==='en'?'WebM recording is unavailable in this browser.':'このブラウザはWebM録画に対応していません。');
  const axis=Number($('clip-axis').value),nodes=output?.mesh?.nodes||[],coordinates=nodes.filter((_,i)=>i%3===axis),saved={position:camera.position.clone(),target:controls.target.clone(),damping:controls.enableDamping,enabled:controls.enabled,scale:$('deform-scale').value,clip:$('clip-enabled').checked,plane:$('clip-position').value,time:time?.value},state={stop:false};
  const abort=()=>{state.stop=true;};signal?.addEventListener('abort',abort,{once:true});
  active=state;controls.enabled=false;controls.enableDamping=false;message('再生を開始しています。','Starting playback.');
  const locked=[...document.querySelectorAll('#app button,#app input,#app select,aside summary')].filter(el=>el.id!=='animation-stop'&&el.id!=='agent-disconnect'&&!el.closest?.('#agent-connection')),disabled=locked.map(el=>el.disabled);
  locked.forEach(el=>{el.disabled=true;});$('animation-stop').disabled=false;
  let recorder,stream,chunks=[],finished,completed=false;
  try{
   if(record){capture();stream=canvas.captureStream(24);recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});finished=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||Error('Recording failed'));});finished.catch(()=>{state.stop=true;});recorder.start();}
   const started=performance.now(),offset=saved.position.clone().sub(saved.target);
   await new Promise((resolve,reject)=>{function tick(now){try{const phase=Math.max(0,Math.min(1,(now-started)/(seconds*1000))),s=animationState(kind,phase,{scale:Number(saved.scale),frames:result?.snapshots?.length||1,min:coordinates.length?Math.min(...coordinates):0,max:coordinates.length?Math.max(...coordinates):1});if(getAnalysis()!==output){state.stop=true;resolve();return;}if(state.stop){resolve();return;}
    if(kind==='orbit'){camera.position.copy(offset).applyAxisAngle({x:0,y:1,z:0},s.angle).add(saved.target);camera.lookAt(saved.target);}
    else if(kind==='deformation'){$('deform-scale').value=s.deformScale;redraw();}
    else if(kind==='time'){time.value=s.frame;time.dispatchEvent(new Event('input'));}
    else {$('clip-enabled').checked=true;$('clip-position').value=s.position;$('clip-position').dispatchEvent(new Event('input'));}
    message(kind==='time'?'表示時間 '+result.snapshots[s.frame].time.toPrecision(5)+' s（動画は表示用の時間尺度）':kind==='deformation'?'表示用の変形往復 · 倍率 '+s.deformScale.toPrecision(4):'アニメーション '+kind+' · '+Math.round(phase*100)+'%',kind==='time'?'Physical time '+result.snapshots[s.frame].time.toPrecision(5)+' s (visualization time scale)':kind==='deformation'?'Visual deformation cycle · scale '+s.deformScale.toPrecision(4):'Animation '+kind+' · '+Math.round(phase*100)+'%');capture();onProgress({fraction:phase,kind,physicalTimeSeconds:kind==='time'?result.snapshots[s.frame].time:undefined});if(phase>=1){completed=true;resolve();}else requestAnimationFrame(tick);
   }catch(error){reject(error);}}requestAnimationFrame(tick);});
  }finally{
   try{if(recorder&&recorder.state==='recording'&&completed&&!state.stop){capture();stream?.getVideoTracks?.()[0]?.requestFrame?.();await new Promise(resolve=>setTimeout(resolve,150));try{recorder.requestData?.();}catch{}}if(recorder&&recorder.state!=='inactive')recorder.stop();if(finished)await finished;}
   finally{stream?.getTracks().forEach(track=>track.stop());camera.position.copy(saved.position);camera.lookAt(saved.target);controls.target.copy(saved.target);controls.enabled=saved.enabled;controls.enableDamping=saved.damping;$('deform-scale').value=saved.scale;$('clip-enabled').checked=saved.clip;$('clip-position').value=saved.plane;try{if(time){time.value=saved.time;time.dispatchEvent(new Event('input'));}if(getAnalysis()===output&&output)redraw();$('clip-position').dispatchEvent(new Event('input'));}finally{locked.forEach((el,i)=>{el.disabled=disabled[i];});$('animation-stop').disabled=true;active=null;signal?.removeEventListener('abort',abort);}}
  }
  const blob=record&&chunks.length?new Blob(chunks,{type:mime}):null;if(record&&blob&&!state.stop&&!await hasVideoFrames(blob))throw Error('Recording produced no video frames');if(save&&blob&&!state.stop)download(blob,'simulation-'+kind+'.webm');message(state.stop?'再生を停止しました。':'再生が完了しました。',state.stop?'Playback stopped.':'Playback completed.');
  if(state.stop)throw Error('Export cancelled');if(record&&!blob)throw Error('Recording produced no data');return blob;
 }
 for(const [id,record]of [['animation-preview',false],['animation-save',true]])$(id).onclick=()=>animate(record).catch(error=>message(error.message,error.message));

  // Same checks renderSequence runs, exposed so the job layer can refuse at start instead of failing after the job began.
 function preflight({animation='orbit'}={}){
  const output=getAnalysis(),result=output?.result;
  if(!FIXED_FRAME_ANIMATIONS.includes(animation))throw Error('Invalid animation type');
  if(animation==='deformation'&&!['elastic','modal'].includes(result?.kind))throw Error('Deformation requires a structural or modal result.');
  if(animation==='time'&&(result?.kind!=='acousticTransient'||!$('acoustic-time-frame')||!result.snapshots?.length))throw Error('Time playback requires transient acoustic frames.');
  if(animation==='slice'&&!output?.mesh)throw Error('Generate a volume mesh first.');
 }
 // Fixed-frame PNG sequence: frame i is rendered from the stored view state for index i of N; wall-clock time and tab throttling never enter the result.
 async function renderSequence({animation='orbit',frames=FIXED_FRAME_LIMITS.defaultFrames,view={},expectedResultRevision,signal,onProgress=()=>{}}){
  if(signal?.aborted)throw Error('Export cancelled');
  validateFrameCount(frames);
  if(typeof crypto==='undefined'||!crypto.subtle?.digest)throw Error('png-sequence export requires SHA-256 support');
  if(!FIXED_FRAME_ANIMATIONS.includes(animation))throw Error('Invalid animation type');
  preflight({animation});
  const output=getAnalysis(),result=output?.result,time=$('acoustic-time-frame');
  const axis=Number($('clip-axis').value),nodes=output?.mesh?.nodes||[],coordinates=nodes.filter((_,i)=>i%3===axis),min=coordinates.length?Math.min(...coordinates):0,max=coordinates.length?Math.max(...coordinates):1;
  const saved={position:camera.position.clone(),target:controls.target.clone(),damping:controls.enableDamping,enabled:controls.enabled,scale:$('deform-scale').value,clip:$('clip-enabled').checked,plane:$('clip-position').value,time:time?.value};
  const schedule=fixedFrameSchedule({animation,frames,state:animationState,scale:Number(saved.scale),snapshotTimes:animation==='time'?result.snapshots.map(snapshot=>snapshot.time):[],min,max});
  const state={stop:false};active=state;controls.enabled=false;controls.enableDamping=false;
  const locked=[...document.querySelectorAll('#app button,#app input,#app select,aside summary')].filter(el=>el.id!=='agent-disconnect'&&!el.closest?.('#agent-connection')),disabled=locked.map(el=>el.disabled);locked.forEach(el=>{el.disabled=true;});
  const offset=saved.position.clone().sub(saved.target),startPosition=[saved.position.x,saved.position.y,saved.position.z],startTarget=[saved.target.x,saved.target.y,saved.target.z],entries=[],records=[];let total=0,resolution;
  try{
   for(const step of schedule){
    if(signal?.aborted||state.stop)throw Error('Export cancelled');
    if(getAnalysis()!==output)throw Error('Displayed result changed during export');
    if(animation==='orbit'){camera.position.copy(offset).applyAxisAngle({x:0,y:1,z:0},step.angleRadians).add(saved.target);camera.lookAt(saved.target);}
    else if(animation==='deformation'){$('deform-scale').value=step.deformScale;redraw();}
    else if(animation==='time'){time.value=step.snapshotIndex;time.dispatchEvent(new Event('input'));}
    else{$('clip-enabled').checked=true;$('clip-position').value=step.slicePosition;$('clip-position').dispatchEvent(new Event('input'));}
    message('固定フレーム '+(step.index+1)+'/'+frames,'Fixed frame '+(step.index+1)+'/'+frames);
    const frame=capture(),width=frame.width,height=frame.height;
    const blob=await new Promise((resolve,reject)=>frame.toBlob(value=>value?resolve(value):reject(Error('Image capture failed')),'image/png'));
    if(signal?.aborted||state.stop)throw Error('Export cancelled');
    const bytes=new Uint8Array(await blob.arrayBuffer());
    if(bytes.length>FIXED_FRAME_LIMITS.maxFrameBytes)throw Error('png-sequence frame '+step.index+' exceeds the '+FIXED_FRAME_LIMITS.maxFrameBytes+' byte frame cap');
    total+=bytes.length;if(total>FIXED_FRAME_LIMITS.maxTotalBytes)throw Error('png-sequence exceeds the '+FIXED_FRAME_LIMITS.maxTotalBytes+' byte total cap; reduce frames');
    if(resolution&&(resolution.width!==width||resolution.height!==height))throw Error('Canvas resolution changed during export');resolution={width,height};
    const name='frame-'+String(step.index).padStart(4,'0')+'.png';entries.push({name,bytes});
    records.push({...step,file:name,resultRevision:expectedResultRevision,width,height,bytes:bytes.length,sha256:'sha256:'+await sha256Hex(bytes),...(animation==='orbit'?{camera:{position:orbitCameraPosition(startPosition,startTarget,step.angleRadians)}}:{})});
    if(signal?.aborted||state.stop)throw Error('Export cancelled');
    onProgress({fraction:(step.index+1)/frames*.98});
   }
   const manifest={schemaVersion:1,kind:'airpocket-fixed-frame-png-sequence',resultRevision:expectedResultRevision,animation,frameCount:frames,resolution,
    schedule:{basis:'fixed',timeBasis:animation==='time'?'stored acoustic frames':'frame index',phase:animation==='orbit'||animation==='deformation'?'index/frameCount':'index/(frameCount-1)',realtime:false,wallClockIndependent:true},
    view:pickViewFields(view),scale:{units:{time:'second',angle:'radian'},...(animation==='deformation'?{deformScaleKind:'visualization multiplier'}:{})},frames:records};
   const manifestBytes=new TextEncoder().encode(JSON.stringify(manifest,null,1));
   if(signal?.aborted||state.stop)throw Error('Export cancelled');
   const zip=buildStoreZip([{name:'manifest.json',bytes:manifestBytes},...entries]);onProgress({fraction:1});
   return new Blob([zip],{type:'application/zip'});
  }finally{
   try{camera.position.copy(saved.position);camera.lookAt(saved.target);controls.target.copy(saved.target);controls.enabled=saved.enabled;controls.enableDamping=saved.damping;$('deform-scale').value=saved.scale;$('clip-enabled').checked=saved.clip;$('clip-position').value=saved.plane;
    try{if(time){time.value=saved.time;time.dispatchEvent(new Event('input'));}if(getAnalysis()===output&&output)redraw();$('clip-position').dispatchEvent(new Event('input'));}finally{locked.forEach((el,i)=>{el.disabled=disabled[i];});active=null;}}
   catch(error){active=null;throw error;}
  }
 }
 async function render({format,animation,seconds,frames,view,expectedResultRevision,signal,onProgress=()=>{}}){
  if(active||!$('cancel-run').disabled)throw Error('Viewer is busy');
  if(signal?.aborted)throw Error('Export cancelled');
  if(format==='png-sequence')return renderSequence({animation,frames,view,expectedResultRevision,signal,onProgress});
  if(format==='webm')return animate(true,{animation,seconds,signal,onProgress,save:false});
  if(format!=='png')throw Error('Unsupported export format');
  const state={stop:false};active=state;const locked=[...document.querySelectorAll('#app button,#app input,#app select,aside summary')].filter(el=>el.id!=='agent-disconnect'&&!el.closest?.('#agent-connection')),disabled=locked.map(el=>el.disabled);locked.forEach(el=>{el.disabled=true;});
  try{message('表示中の画像','Current view');const frame=capture();onProgress({fraction:0});const blob=await new Promise((resolve,reject)=>frame.toBlob(value=>value?resolve(value):reject(Error('Image capture failed')),'image/png'));if(signal?.aborted||state.stop)throw Error('Export cancelled');onProgress({fraction:1});return blob;}finally{locked.forEach((el,i)=>{el.disabled=disabled[i];});active=null;}
 }
 const pngSequenceSupported=()=>typeof crypto!=='undefined'&&!!crypto.subtle?.digest;
 const pngSequenceCapability=()=>pngSequenceSupported()?{supported:true,container:'zip',compression:'store',...FIXED_FRAME_LIMITS,animations:[...FIXED_FRAME_ANIMATIONS],recording:'fixed-frame',realtime:false,wallClockIndependent:true,frameCountGuaranteed:true,manifest:'manifest.json (per-frame resultRevision, phase/angle/time, resolution, SHA-256)'}:{supported:false,reason:'SHA-256 (crypto.subtle) is unavailable',alternatives:['png']};
 const capabilities=({mediaRecorder=typeof MediaRecorder==='undefined'?undefined:MediaRecorder}={})=>{const formats=exportFormatCapabilities({mediaRecorder});formats['png-sequence']=pngSequenceCapability();return {schemaVersion:1,png:true,'png-sequence':pngSequenceSupported(),webm:!!mediaRecorder&&!!canvas.captureStream&&WEBM_TYPES.some(type=>safeSupported(mediaRecorder,type)),mp4:formats.mp4.supported,gif:formats.gif.supported,formats,animations:['orbit','deformation','time','slice'],timeSelection:'stored-acoustic-frames-only',recording:'realtime',targetFrameRate:24,frameCountGuaranteed:false,maxSeconds:15};};
 return {stop,capture,render,preflight,capabilities,isActive:()=>active!==null};
}
