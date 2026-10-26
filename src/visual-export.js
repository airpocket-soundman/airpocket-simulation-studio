import {singleDeformationGifCapabilities,createSingleDeformationGifPlan,encodeSingleDeformationGif} from './ui/single-deformation-gif.js';
import {singleStoredTimeGifCapabilities,createSingleStoredTimeGifPlan,encodeSingleStoredTimeGif} from './ui/single-stored-time-gif.js';
import {singleOrbitGifCapabilities,encodeSingleOrbitGif} from './ui/single-orbit-gif.js';
import {canonicalJson} from './project-revision.js';
import {singleViewTimeWebmCapabilities,singleThermalTimeWebmCapabilities,createSingleViewThermalTimePlan,encodeSingleViewThermalTimeWebm,createSingleViewAcousticTimePlan,encodeSingleViewAcousticTimeWebm} from './single-view-time-webm.js';
import {createWebmRecordingLifecycle,waitForWebmStop} from './ui/webm-recording-lifecycle.js';
import {framesOf} from './result-frames.js';
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
// MP4 is not exported by this application; orbit GIF uses the separate bounded canvas encoder. The MediaRecorder probe only explains why MP4 is refused;
// it can never make `supported` true because no MP4 encoder or muxer path exists here.
export function exportFormatCapabilities({mediaRecorder,...gifEnv}={}){
 const mp4Type=MP4_TYPES.find(type=>safeSupported(mediaRecorder,type)),alternatives=['webm','png'];
 return {
  mp4:{supported:false,browserRecorderSupport:!!mp4Type,...(mp4Type?{probedMimeType:mp4Type}:{}),reason:mp4Type?'MediaRecorder reports MP4 recording in this browser, but MP4 export is not implemented in this application':'MediaRecorder does not support the MP4 container in this browser',alternatives:[...alternatives]},
  gif:singleOrbitGifCapabilities(gifEnv)
 };
}

export function installVisualExport({renderer,scene,camera,controls,getAnalysis,redraw,language,translate,getTimeView,restoreTimeView,recordingEnv={}}){
 const $=id=>document.getElementById(id),host=document.createElement('details');
 host.innerHTML=`<summary>画像・アニメーションを保存</summary><label><input id="result-surface" type="checkbox" checked> 結果の表面を表示</label><label><input id="result-surface-wire" type="checkbox"> 結果の表面メッシュを表示</label><button id="view-png">表示中の画像をPNGで保存</button><label>アニメーションの種類<select id="animation-kind"><option value="orbit">モデルを一周</option><option value="deformation">変形を往復（表示用）</option><option value="time">保存時刻（音響・温度）</option><option value="slice">断面を移動</option></select></label><label>動画の長さ（秒）<input id="animation-seconds" type="number" value="4" min="1" max="15" step="1"></label><div class="row"><button id="animation-preview">再生</button><button id="animation-save">WebM動画で保存</button><button id="animation-gif-save">GIFで保存</button><button id="animation-stop" disabled>再生を止める</button></div><p>画像・動画には現在の色、単位、メッシュ、断面を含めます。変形の往復は表示用で、載荷履歴の再計算ではありません。時間変化のWebMは保存した音響・温度フレームを使い、動画時間は表示用に伸縮します。温度はWebM・GIF保存に対応し、再生ボタンは未対応です。熱流束の時間変化は出力できません。GIFは回転・保存時刻・線形変位の表示用往復に対応し、24枚・640×320・256色の短いプレビューです。保存時刻GIFは最初と最後を含む最寄りの保存フレームを使い、補間しません。</p><p id="visual-export-status" role="status"></p><a id="visual-export-download" hidden></a>`;
 $('result-legend').after(host);
 translate({'画像・アニメーションを保存':'Save images and animations','結果の表面を表示':'Show result surface','結果の表面メッシュを表示':'Show result surface mesh','表示中の画像をPNGで保存':'Save current view as PNG','アニメーションの種類':'Animation type','モデルを一周':'Orbit the model','変形を往復（表示用）':'Deformation cycle (visualization)','保存時刻（音響・温度）':'Stored time (acoustic / temperature)','断面を移動':'Move section plane','動画の長さ（秒）':'Video duration (seconds)','再生':'Play','WebM動画で保存':'Save WebM video','GIFで保存':'Save GIF','再生を止める':'Stop playback','画像・動画には現在の色、単位、メッシュ、断面を含めます。変形の往復は表示用で、載荷履歴の再計算ではありません。時間変化のWebMは保存した音響・温度フレームを使い、動画時間は表示用に伸縮します。温度はWebM・GIF保存に対応し、再生ボタンは未対応です。熱流束の時間変化は出力できません。GIFは回転・保存時刻・線形変位の表示用往復に対応し、24枚・640×320・256色の短いプレビューです。保存時刻GIFは最初と最後を含む最寄りの保存フレームを使い、補間しません。':'Images and videos include current colors, units, mesh and sections. Deformation cycles are visualizations, not recalculated load histories. Time WebM uses stored acoustic or temperature frames with a visualization time scale. Temperature supports Save WebM and GIF, not the Play button. Heat-flux time export is unavailable. GIF supports orbit, stored time and visual displacement cycles: 24 frames, 640 by 320, 256 colors. Stored-time GIF uses nearest saved frames including both endpoints, without interpolation.'});
 $('result-surface').onchange=redraw;$('result-surface-wire').onchange=redraw;
 let active=null,downloadUrl;
 const message=(ja,en)=>$('visual-export-status').textContent=language()==='en'?en:ja;
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
 function capture({maxWidth=1920,maxHeight=Infinity,gifLayout=false}={}){
  renderer.render(scene,camera);const source=renderer.domElement,w=Math.max(1,Math.floor(Math.min(maxWidth,source.width,(maxHeight-116)*source.width/source.height))),h=Math.max(1,Math.round(source.height*w/source.width));
  const outputWidth=gifLayout?640:w,outputHeight=gifLayout?320:h+116,captionY=gifLayout?204:h;
  if(canvas.width!==outputWidth||canvas.height!==outputHeight){canvas.width=outputWidth;canvas.height=outputHeight;}
  context.fillStyle='#102331';context.fillRect(0,0,outputWidth,outputHeight);context.drawImage(source,gifLayout?Math.floor((640-w)/2):0,gifLayout?Math.floor((204-h)/2):0,w,h);
  context.fillStyle='#edf6f8';context.font='15px sans-serif';
  const lines=['airpocket Simulation Studio · '+$('name').textContent,(getAnalysis()?.result?.analysisAssessment?.provisional?(language()==='en'?'PROVISIONAL · ':'暫定解析 · '):'')+$('result-legend').textContent,$('section-summary').textContent,$('visual-export-status').textContent];
  lines.forEach((text,i)=>context.fillText(text,16,captionY+23+23*i,outputWidth-32));return canvas;
 }
 function download(blob,name){if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(blob);const link=$('visual-export-download');link.href=downloadUrl;link.download=name;link.textContent=language()==='en'?'Download again':'もう一度ダウンロード';link.hidden=false;link.click();}
 const stop=()=>{if(active){active.stop=true;active.interrupt?.();}};$('animation-stop').onclick=stop;
 $('view-png').onclick=()=>{try{message('表示中の画像','Current view');capture().toBlob(blob=>{if(blob)download(blob,'simulation-view.png');else message('画像を作成できませんでした。','Image capture failed.');},'image/png');}catch(error){message(error.message,error.message);}};
 async function animate(record,{animation,seconds:requestedSeconds,signal,onProgress=()=>{},save=true,expectedResultRevision}={}){
  if(active)throw Error(language()==='en'?'Playback is already active.':'再生中です。');
  if(!$('cancel-run').disabled)throw Error(language()==='en'?'Wait for analysis to finish.':'解析の完了を待ってください。');
  const kind=animation??$('animation-kind').value,seconds=requestedSeconds??Number($('animation-seconds').value),output=getAnalysis(),result=output?.result;
  if(signal?.aborted)throw Error('Export cancelled');
  if(!['orbit','deformation','time','slice'].includes(kind))throw Error('Invalid animation type');
  if(!Number.isInteger(seconds)||seconds<1||seconds>15)throw Error(language()==='en'?'Duration must be 1–15 seconds.':'長さは1～15秒で指定してください。');
  if(kind==='deformation'&&!['elastic','modal'].includes(result?.kind))throw Error(language()==='en'?'Deformation requires a structural or modal result.':'変形には構造または固有振動の結果が必要です。');
  const time=$('acoustic-time-frame');
  if(kind==='time'&&result?.kind==='thermal'&&!record)throw Error(language()==='en'?'Thermal time preview is unavailable. Use Save WebM for stored temperature frames, or use the viewer slider.':'熱の時間変化プレビューは未対応です。保存温度フレームはWebM動画で保存するか、表示時刻スライダーを使ってください。');
  if(kind==='time'&&(!['acousticTransient','thermal'].includes(result?.kind)||!time))throw Error(language()==='en'?'Time playback requires transient acoustic frames.':'時間変化には過渡音響の結果が必要です。');
  if(kind==='slice'&&!output?.mesh)throw Error(language()==='en'?'Generate a volume mesh first.':'先に体積メッシュを生成してください。');
  if(record&&kind==='time')return renderFixedAcousticTime({seconds,signal,onProgress,save,expectedResultRevision});
  const mime=WEBM_TYPES.find(type=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(type));
  if(record&&(!mime||!canvas.captureStream))throw Error(language()==='en'?'WebM recording is unavailable in this browser.':'このブラウザはWebM録画に対応していません。');
  const axis=Number($('clip-axis').value),nodes=output?.mesh?.nodes||[],coordinates=nodes.filter((_,i)=>i%3===axis),saved={position:camera.position.clone(),target:controls.target.clone(),damping:controls.enableDamping,enabled:controls.enabled,scale:$('deform-scale').value,clip:$('clip-enabled').checked,plane:$('clip-position').value,time:time?.value,timeView:getTimeView?.()},state={stop:false};
  const abort=()=>{state.stop=true;state.interrupt?.();};signal?.addEventListener('abort',abort,{once:true});
  active=state;controls.enabled=false;controls.enableDamping=false;message('再生を開始しています。','Starting playback.');
  const locked=[...document.querySelectorAll('#app button,#app input,#app select,aside summary')].filter(el=>el.id!=='animation-stop'&&el.id!=='agent-disconnect'&&!el.closest?.('#agent-connection')),disabled=locked.map(el=>el.disabled);
  locked.forEach(el=>{el.disabled=true;});$('animation-stop').disabled=false;
  let recorder,stream,chunks=[],finished,completed=false,lifecycle,frameId,recordingFailure;
  try{
   if(record){lifecycle=createWebmRecordingLifecycle({...recordingEnv,onFailure:error=>{recordingFailure??=error;state.stop=true;state.interrupt?.(error);}});capture();stream=canvas.captureStream(24);recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});finished=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||Error('Recording failed'));});finished.catch(error=>{recordingFailure??=error;state.stop=true;state.interrupt?.(error);});recorder.start();}
   const started=performance.now(),offset=saved.position.clone().sub(saved.target);
   await new Promise((resolve,reject)=>{state.interrupt=error=>{if(frameId!==undefined)globalThis.cancelAnimationFrame?.(frameId);reject(error??Error('Export cancelled'));};function tick(now){try{lifecycle?.check();const phase=Math.max(0,Math.min(1,(now-started)/(seconds*1000))),s=animationState(kind,phase,{scale:Number(saved.scale),frames:result?.snapshots?.length||1,min:coordinates.length?Math.min(...coordinates):0,max:coordinates.length?Math.max(...coordinates):1});if(getAnalysis()!==output){state.stop=true;resolve();return;}if(state.stop){resolve();return;}
    if(kind==='orbit'){camera.position.copy(offset).applyAxisAngle({x:0,y:1,z:0},s.angle).add(saved.target);camera.lookAt(saved.target);}
    else if(kind==='deformation'){$('deform-scale').value=s.deformScale;redraw();}
    else if(kind==='time'){time.value=s.frame;time.dispatchEvent(new Event('input'));}
    else {$('clip-enabled').checked=true;$('clip-position').value=s.position;$('clip-position').dispatchEvent(new Event('input'));}
    message(kind==='time'?'表示時間 '+result.snapshots[s.frame].time.toPrecision(5)+' s（動画は表示用の時間尺度）':kind==='deformation'?'表示用の変形往復 · 倍率 '+s.deformScale.toPrecision(4):'アニメーション '+kind+' · '+Math.round(phase*100)+'%',kind==='time'?'Physical time '+result.snapshots[s.frame].time.toPrecision(5)+' s (visualization time scale)':kind==='deformation'?'Visual deformation cycle · scale '+s.deformScale.toPrecision(4):'Animation '+kind+' · '+Math.round(phase*100)+'%');capture();lifecycle?.progress();onProgress({fraction:phase,kind,physicalTimeSeconds:kind==='time'?result.snapshots[s.frame].time:undefined});if(phase>=1){completed=true;resolve();}else frameId=requestAnimationFrame(tick);
   }catch(error){reject(error);}}frameId=requestAnimationFrame(tick);});
  }catch(error){recordingFailure??=error;throw error;}finally{
   if(frameId!==undefined)globalThis.cancelAnimationFrame?.(frameId);state.interrupt=undefined;
   try{if(recorder&&recorder.state==='recording'&&completed&&!state.stop){capture();stream?.getVideoTracks?.()[0]?.requestFrame?.();await new Promise(resolve=>setTimeout(resolve,150));try{recorder.requestData?.();}catch{}}if(recorder&&recorder.state!=='inactive')try{recorder.stop();}catch(error){recordingFailure??=error;finished=undefined;}if(finished)try{await waitForWebmStop(finished,recordingEnv);}catch(error){recordingFailure??=error;}}
   finally{lifecycle?.dispose();if(recorder){recorder.onstop=null;recorder.onerror=null;recorder.ondataavailable=null;}for(const track of stream?.getTracks()??[])try{track.stop();}catch(error){recordingFailure??=error;}camera.position.copy(saved.position);camera.lookAt(saved.target);controls.target.copy(saved.target);controls.enabled=saved.enabled;controls.enableDamping=saved.damping;$('deform-scale').value=saved.scale;$('clip-enabled').checked=saved.clip;$('clip-position').value=saved.plane;try{if(time&&kind==='time'){if(restoreTimeView&&saved.timeView!==undefined)restoreTimeView(saved.timeView);else{time.value=saved.time;time.dispatchEvent(new Event('input'));}}if(getAnalysis()===output&&output)redraw();$('clip-position').dispatchEvent(new Event('input'));}finally{locked.forEach((el,i)=>{el.disabled=disabled[i];});$('animation-stop').disabled=true;active=null;signal?.removeEventListener('abort',abort);}}
  }
  if(recordingFailure)throw recordingFailure;
  const blob=record&&chunks.length?new Blob(chunks,{type:mime}):null;if(record&&blob&&!state.stop&&!await hasVideoFrames(blob))throw Error('Recording produced no video frames');if(save&&blob&&!state.stop)download(blob,'simulation-'+kind+'.webm');message(state.stop?'再生を停止しました。':'再生が完了しました。',state.stop?'Playback stopped.':'Playback completed.');
  if(state.stop)throw Error('Export cancelled');if(record&&!blob)throw Error('Recording produced no data');return blob;
 }
 for(const [id,record]of [['animation-preview',false],['animation-save',true]])$(id).onclick=()=>animate(record).catch(error=>message(error.message,error.message));


 // Stored acoustic export uses the verified fixed codec; preview remains the existing real-time playback.
 async function renderFixedAcousticTime({seconds,signal,onProgress=()=>{},save=false,expectedResultRevision}){
  const output=getAnalysis(),time=$('acoustic-time-frame'),thermal=output?.result?.kind==='thermal',field=$('result-field')?.value;
  if(thermal)createSingleViewThermalTimePlan(output,seconds,field);else createSingleViewAcousticTimePlan(output,seconds);
  const capability=(thermal?singleThermalTimeWebmCapabilities:singleViewTimeWebmCapabilities)(recordingEnv);if(!capability.supported)throw Object.assign(Error(language()==='en'?'Stored-time WebM needs video encoding and decoding support. Use PNG sequence instead.':capability.reason),{code:'WEBM_FIXED_UNSUPPORTED'});
  const saved={position:camera.position.clone(),target:controls.target.clone(),damping:controls.enableDamping,enabled:controls.enabled,scale:$('deform-scale').value,clip:$('clip-enabled').checked,plane:$('clip-position').value,time:time.value,timeView:getTimeView?.()},controller=new AbortController(),state={stop:false,interrupt:()=>controller.abort()};
  const abort=()=>{state.stop=true;controller.abort();};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const locked=[...document.querySelectorAll('#app button,#app input,#app select,aside summary')].filter(el=>el.id!=='animation-stop'&&el.id!=='agent-disconnect'&&!el.closest?.('#agent-connection')),disabled=locked.map(el=>el.disabled);
  active=state;controls.enabled=false;controls.enableDamping=false;locked.forEach(el=>{el.disabled=true;});$('animation-stop').disabled=false;
  const check=()=>{if(state.stop||controller.signal.aborted)throw Object.assign(Error('Export cancelled'),{code:'WEBM_FIXED_CANCELLED'});if(getAnalysis()!==output||active!==state||thermal&&$('result-field')?.value!=='temperature')throw Object.assign(Error('Displayed result changed during export'),{code:'WEBM_ENDPOINT_UNVERIFIED'});};let blob;
  try{
   check();const initialCanvas=capture({maxWidth:1280,maxHeight:640});
   blob=await (thermal?encodeSingleViewThermalTimeWebm:encodeSingleViewAcousticTimeWebm)({output,field,seconds,resultRevision:expectedResultRevision,initialCanvas,signal:controller.signal,assertCurrent:check,onProgress,renderFrame:step=>{
    check();time.value=step.snapshotIndex;time.dispatchEvent(new Event('input'));check();
    message('実保存時刻 '+step.actualTimeSeconds.toPrecision(5)+' s · 要求 '+step.requestedTimeSeconds.toPrecision(5)+' s · ずれ '+step.offsetSeconds.toPrecision(4)+' s','Stored time '+step.actualTimeSeconds.toPrecision(5)+' s · requested '+step.requestedTimeSeconds.toPrecision(5)+' s · offset '+step.offsetSeconds.toPrecision(4)+' s');
    return capture({maxWidth:1280,maxHeight:640});
   }},recordingEnv);check();
  }finally{
   try{camera.position.copy(saved.position);camera.lookAt(saved.target);controls.target.copy(saved.target);controls.enabled=saved.enabled;controls.enableDamping=saved.damping;$('deform-scale').value=saved.scale;$('clip-enabled').checked=saved.clip;$('clip-position').value=saved.plane;
    if(getAnalysis()===output){if(restoreTimeView&&saved.timeView!==undefined)restoreTimeView(saved.timeView);else{time.value=saved.time;time.dispatchEvent(new Event('input'));}if(output)redraw();$('clip-position').dispatchEvent(new Event('input'));}
   }finally{locked.forEach((el,i)=>{el.disabled=disabled[i];});$('animation-stop').disabled=true;active=null;signal?.removeEventListener('abort',abort);}
  }
  if(save)download(blob,'simulation-time.webm');message('動画の全フレームと終端を確認しました。','All video frames and the endpoint were verified.');return blob;
 }

 async function renderOrbitGif({animation='orbit',seconds,signal,onProgress=()=>{},save=false,expectedResultRevision}={}){
  if(active||!$('cancel-run').disabled)throw Error('Viewer is busy');
  if(animation!=='orbit')throw Error('Single-view GIF supports orbit only');
  const output=getAnalysis(),field=$('result-field')?.value;
  if(!output?.result||!field)throw Error('Display a result field before saving an orbit GIF');
  if(!singleOrbitGifCapabilities(recordingEnv).supported)throw Error(language()==='en'?'Orbit GIF needs a readable canvas and SHA-256.':'回転GIFには読み取り可能なcanvasとSHA-256が必要です。');
  const saved={position:camera.position.clone(),target:controls.target.clone(),up:camera.up?.clone?.(),fov:camera.fov,damping:controls.enableDamping,enabled:controls.enabled,timeView:getTimeView?.()},timeKey=saved.timeView===undefined?undefined:canonicalJson(saved.timeView),controller=new AbortController(),state={stop:false,interrupt:()=>controller.abort()};
  const abort=()=>{state.stop=true;controller.abort();};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const locked=[...document.querySelectorAll('#app button,#app input,#app select,aside summary')].filter(el=>el.id!=='animation-stop'&&el.id!=='agent-disconnect'&&!el.closest?.('#agent-connection')),disabled=locked.map(el=>el.disabled);
  active=state;controls.enabled=false;controls.enableDamping=false;locked.forEach(el=>el.disabled=true);$('animation-stop').disabled=false;
  const viewKeys=[['result-field','value'],['result-mode','value'],['deform-scale','value'],['clip-enabled','checked'],['clip-axis','value'],['clip-position','value'],['clip-flip','checked'],['model-opacity','value'],['result-surface','checked'],['result-surface-wire','checked'],['volume-wire','checked'],['result-section','checked'],['color-fixed','checked'],['color-min','value'],['color-max','value']],viewSnapshot=()=>canonicalJson(viewKeys.flatMap(([id,key])=>$(id)?[[id,key,$(id)[key]??null]]:[])),savedView=viewKeys.flatMap(([id,key])=>$(id)?[[id,key,$(id)[key]??null]]:[]),viewKey=canonicalJson(savedView),sourceResolution={width:renderer.domElement.width,height:renderer.domElement.height};
  const timeState=saved.timeView?.state??saved.timeView,viewerFrameIndex=Number.isSafeInteger(timeState?.frameIndex)?timeState.frameIndex:undefined,viewTimeSeconds=Number.isFinite(timeState?.timeSeconds)?timeState.timeSeconds:output.result.snapshots?.[viewerFrameIndex]?.time,stored=framesOf(output.result),timeApplies=stored?.fieldId===field,modeIndex=output.result.kind==='modal'?Number($('result-mode')?.value):undefined,interpolated=Number.isFinite(timeState?.timeSeconds)&&!!stored&&!stored.times.includes(timeState.timeSeconds);
  const check=()=>{if(state.stop||controller.signal.aborted)throw Object.assign(Error('Orbit GIF cancelled'),{code:'GIF_ORBIT_CANCELLED'});if(getAnalysis()!==output||$('result-field')?.value!==field||active!==state||viewSnapshot()!==viewKey||camera.fov!==saved.fov||saved.up&&(!camera.up||camera.up.x!==saved.up.x||camera.up.y!==saved.up.y||camera.up.z!==saved.up.z)||renderer.domElement.width!==sourceResolution.width||renderer.domElement.height!==sourceResolution.height||timeKey!==undefined&&canonicalJson(getTimeView?.())!==timeKey)throw Object.assign(Error('Displayed result, field or time changed during GIF export'),{code:'GIF_ORBIT_INVALID'});};let blob;
  try{check();const start={position:[saved.position.x,saved.position.y,saved.position.z],target:[saved.target.x,saved.target.y,saved.target.z],up:camera.up?.toArray?.()??[0,1,0],fov:camera.fov??40};
   blob=await encodeSingleOrbitGif({camera:start,field,resultRevision:expectedResultRevision,viewTimeSeconds,viewerFrameIndex,interpolated,timeApplies,modeIndex,animation,seconds,signal:controller.signal,onProgress,assertCurrent:check,renderFrame:(next,step)=>{
    check();camera.position.copy({x:next.position[0],y:next.position[1],z:next.position[2]});camera.lookAt(next.target[0],next.target[1],next.target[2]);message('回転GIF '+(step.index+1)+'/24'+(!timeApplies||viewTimeSeconds===undefined?' · 表示結果は固定':' · '+(interpolated?'補間表示 ':'表示時刻 ')+viewTimeSeconds.toPrecision(5)+' s（固定）'),'Orbit GIF '+(step.index+1)+'/24'+(!timeApplies||viewTimeSeconds===undefined?' · displayed result is fixed':' · '+(interpolated?'interpolated view ':'view time ')+viewTimeSeconds.toPrecision(5)+' s (fixed)'));return capture({maxWidth:640,maxHeight:320,gifLayout:true});
   }},recordingEnv);check();
  }finally{try{camera.position.copy(saved.position);controls.target.copy(saved.target);if(saved.up)camera.up.copy(saved.up);camera.fov=saved.fov;camera.lookAt(saved.target);camera.updateProjectionMatrix?.();controls.enabled=saved.enabled;controls.enableDamping=saved.damping;if(getAnalysis()===output){const mode=$('result-mode'),modeChanged=mode&&savedView.some(([id,key,value])=>id==='result-mode'&&key==='value'&&mode.value!==value);for(const [id,key,value]of savedView)if($(id))$(id)[key]=value;if(modeChanged)mode.dispatchEvent(new Event('change'));if(saved.timeView!==undefined)restoreTimeView?.(saved.timeView);redraw();}}finally{locked.forEach((el,i)=>el.disabled=disabled[i]);$('animation-stop').disabled=true;active=null;signal?.removeEventListener('abort',abort);}}
  if(save){download(blob,'simulation-orbit.gif');message('\u56de\u8ee2GIF\u3092\u4f5c\u6210\u3057\u307e\u3057\u305f\u3002','Orbit GIF completed.');}else message('GIF\u306e\u30d5\u30ec\u30fc\u30e0\u3092\u4f5c\u6210\u3057\u307e\u3057\u305f\u3002','GIF frames created.');return blob;
 }

 async function renderStoredTimeGif({seconds,signal,onProgress=()=>{},save=false,expectedResultRevision}={}){
  if(active||!$('cancel-run').disabled)throw Error('Viewer is busy');
  const output=getAnalysis(),field=$('result-field')?.value,plan=createSingleStoredTimeGifPlan(output,seconds,field),time=$('acoustic-time-frame');
  if(!time||!singleStoredTimeGifCapabilities(recordingEnv).supported)throw Error('Stored-time GIF needs stored frames, readable canvas and SHA-256');
  const saved={position:camera.position.clone(),target:controls.target.clone(),up:camera.up?.clone?.(),fov:camera.fov,damping:controls.enableDamping,enabled:controls.enabled,time:time.value,timeView:getTimeView?.()},controller=new AbortController(),state={stop:false,interrupt:()=>controller.abort()};
  const abort=()=>{state.stop=true;controller.abort();};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const locked=[...document.querySelectorAll('#app button,#app input,#app select,aside summary')].filter(el=>el.id!=='animation-stop'&&el.id!=='agent-disconnect'&&!el.closest?.('#agent-connection')),disabled=locked.map(el=>el.disabled);
  const viewKeys=[['result-field','value'],['result-mode','value'],['deform-scale','value'],['clip-enabled','checked'],['clip-axis','value'],['clip-position','value'],['clip-flip','checked'],['model-opacity','value'],['result-surface','checked'],['result-surface-wire','checked'],['volume-wire','checked'],['result-section','checked'],['color-fixed','checked'],['color-min','value'],['color-max','value']],savedView=viewKeys.flatMap(([id,key])=>$(id)?[[id,key,$(id)[key]??null]]:[]),viewKey=canonicalJson(savedView),viewSnapshot=()=>canonicalJson(viewKeys.flatMap(([id,key])=>$(id)?[[id,key,$(id)[key]??null]]:[]));
  const cameraKey=()=>canonicalJson({position:[camera.position.x,camera.position.y,camera.position.z],target:[controls.target.x,controls.target.y,controls.target.z],up:camera.up?[camera.up.x,camera.up.y,camera.up.z]:[0,1,0],fov:camera.fov??40}),initialCameraKey=cameraKey(),sourceSize={width:renderer.domElement.width,height:renderer.domElement.height},result=output.result,snapshots=result.snapshots,scalar=field==='temperature'?'temperature':'pressure',sources=Array.from({length:snapshots.length},(_,i)=>{const f=snapshots[i];return{frame:f,values:f[scalar],time:f.time};});let expectedTimeKey=getTimeView?.()===undefined?undefined:canonicalJson(getTimeView());
  active=state;controls.enabled=false;controls.enableDamping=false;locked.forEach(el=>el.disabled=true);$('animation-stop').disabled=false;
  const check=()=>{if(state.stop||controller.signal.aborted)throw Object.assign(Error('Stored-time GIF cancelled'),{code:'GIF_TIME_CANCELLED'});if(active!==state||getAnalysis()!==output||output.result!==result||result.snapshots!==snapshots||sources.some((s,i)=>snapshots[i]!==s.frame||s.frame.time!==s.time||s.frame[scalar]!==s.values)||snapshots.length!==sources.length||viewSnapshot()!==viewKey||cameraKey()!==initialCameraKey||renderer.domElement.width!==sourceSize.width||renderer.domElement.height!==sourceSize.height||expectedTimeKey!==undefined&&canonicalJson(getTimeView?.())!==expectedTimeKey)throw Object.assign(Error('Stored-time GIF source or displayed view changed'),{code:'GIF_TIME_INVALID'});};let blob;
  try{check();blob=await encodeSingleStoredTimeGif({output,field,camera:JSON.parse(initialCameraKey),resultRevision:expectedResultRevision,seconds,signal:controller.signal,onProgress,assertCurrent:check,renderFrame:step=>{
    check();time.value=step.snapshotIndex;time.dispatchEvent(new Event('input'));expectedTimeKey=getTimeView?.()===undefined?undefined:canonicalJson(getTimeView());check();
    message('実保存時刻 '+step.actualTimeSeconds.toPrecision(5)+' s · 要求 '+step.requestedTimeSeconds.toPrecision(5)+' s · ずれ '+step.offsetSeconds.toPrecision(4)+' s','Stored time '+step.actualTimeSeconds.toPrecision(5)+' s · requested '+step.requestedTimeSeconds.toPrecision(5)+' s · offset '+step.offsetSeconds.toPrecision(4)+' s');return capture({maxWidth:640,maxHeight:320,gifLayout:true});
   }},recordingEnv);check();
  }finally{try{camera.position.copy(saved.position);controls.target.copy(saved.target);if(saved.up)camera.up.copy(saved.up);camera.fov=saved.fov;camera.lookAt(saved.target);camera.updateProjectionMatrix?.();controls.enabled=saved.enabled;controls.enableDamping=saved.damping;if(getAnalysis()===output){for(const[id,key,value]of savedView)if($(id))$(id)[key]=value;if(saved.timeView!==undefined&&restoreTimeView)restoreTimeView(saved.timeView);else{time.value=saved.time;time.dispatchEvent(new Event('input'));}redraw();}}finally{locked.forEach((el,i)=>el.disabled=disabled[i]);$('animation-stop').disabled=true;active=null;signal?.removeEventListener('abort',abort);}}
  if(save)download(blob,'simulation-time.gif');message('保存時刻GIFを作成しました。','Stored-time GIF frames created.');return blob;
 }

 async function renderDeformationGif({seconds,signal,onProgress=()=>{},save=false,expectedResultRevision}={}){
  if(active||!$('cancel-run').disabled)throw Error('Viewer is busy');const output=getAnalysis(),field=$('result-field')?.value,scale=$('deform-scale'),peakScale=Number(scale.value),modeIndex=output?.result?.kind==='modal'?Number($('result-mode')?.value):null,plan=createSingleDeformationGifPlan(output,seconds,field,peakScale,modeIndex);
  if(!singleDeformationGifCapabilities(recordingEnv).supported)throw Error('Deformation GIF needs readable canvas and SHA-256');
  const saved={position:camera.position.clone(),target:controls.target.clone(),up:camera.up?.clone?.(),fov:camera.fov,damping:controls.enableDamping,enabled:controls.enabled,scale:scale.value,timeView:getTimeView?.()},controller=new AbortController(),state={stop:false,interrupt:()=>controller.abort()};
  const abort=()=>{state.stop=true;controller.abort();};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const locked=[...document.querySelectorAll('#app button,#app input,#app select,aside summary')].filter(el=>el.id!=='animation-stop'&&el.id!=='agent-disconnect'&&!el.closest?.('#agent-connection')),disabled=locked.map(el=>el.disabled);
  const viewKeys=[['result-field','value'],['result-mode','value'],['clip-enabled','checked'],['clip-axis','value'],['clip-position','value'],['clip-flip','checked'],['model-opacity','value'],['result-surface','checked'],['result-surface-wire','checked'],['volume-wire','checked'],['result-section','checked'],['color-fixed','checked'],['color-min','value'],['color-max','value']],savedView=viewKeys.flatMap(([id,key])=>$(id)?[[id,key,$(id)[key]??null]]:[]),viewKey=canonicalJson(savedView),viewSnapshot=()=>canonicalJson(viewKeys.flatMap(([id,key])=>$(id)?[[id,key,$(id)[key]??null]]:[]));
  const cameraKey=()=>canonicalJson({position:[camera.position.x,camera.position.y,camera.position.z],target:[controls.target.x,controls.target.y,controls.target.z],up:camera.up?[camera.up.x,camera.up.y,camera.up.z]:[0,1,0],fov:camera.fov??40}),initialCameraKey=cameraKey(),sourceSize={width:renderer.domElement.width,height:renderer.domElement.height},result=output.result,modes=result.kind==='modal'?result.modes:undefined,selected=result.kind==='modal'?modes[modeIndex]:result,displacement=selected.displacement,magnitudes=selected.magnitudes,nodes=output.mesh.nodes,timeKey=saved.timeView===undefined?undefined:canonicalJson(saved.timeView);let expectedScale=peakScale;
  active=state;controls.enabled=false;controls.enableDamping=false;locked.forEach(el=>el.disabled=true);$('animation-stop').disabled=false;
  const check=()=>{if(state.stop||controller.signal.aborted)throw Object.assign(Error('Deformation GIF cancelled'),{code:'GIF_DEFORMATION_CANCELLED'});if(active!==state||getAnalysis()!==output||output.result!==result||output.mesh.nodes!==nodes||selected.displacement!==displacement||selected.magnitudes!==magnitudes||result.kind==='modal'&&(result.modes!==modes||modes[modeIndex]!==selected)||Number(scale.value)!==expectedScale||viewSnapshot()!==viewKey||cameraKey()!==initialCameraKey||renderer.domElement.width!==sourceSize.width||renderer.domElement.height!==sourceSize.height||timeKey!==undefined&&canonicalJson(getTimeView?.())!==timeKey)throw Object.assign(Error('Deformation GIF source or displayed view changed'),{code:'GIF_DEFORMATION_INVALID'});};let blob;
  try{check();blob=await encodeSingleDeformationGif({output,field,camera:JSON.parse(initialCameraKey),peakScale,modeIndex,resultRevision:expectedResultRevision,seconds,signal:controller.signal,onProgress,assertCurrent:check,renderFrame:step=>{check();scale.value=step.deformScale;expectedScale=step.deformScale;redraw();check();message('表示用変形 · 倍率 '+step.deformScale.toPrecision(5)+(modeIndex===null?' · 固定した保存変位':' · 正規化モード #'+(modeIndex+1))+'（載荷・時間履歴ではありません）','Visual deformation · scale '+step.deformScale.toPrecision(5)+(modeIndex===null?' · fixed saved displacement':' · normalized mode #'+(modeIndex+1))+' (not a load/time history)');return capture({maxWidth:640,maxHeight:320,gifLayout:true});}},recordingEnv);check();
  }finally{try{camera.position.copy(saved.position);controls.target.copy(saved.target);if(saved.up)camera.up.copy(saved.up);camera.fov=saved.fov;camera.lookAt(saved.target);camera.updateProjectionMatrix?.();controls.enabled=saved.enabled;controls.enableDamping=saved.damping;if(getAnalysis()===output){const mode=$('result-mode'),changed=mode&&savedView.some(([id,key,value])=>id==='result-mode'&&key==='value'&&mode.value!==value);for(const[id,key,value]of savedView)if($(id))$(id)[key]=value;scale.value=saved.scale;if(changed)mode.dispatchEvent(new Event('change'));if(saved.timeView!==undefined)restoreTimeView?.(saved.timeView);redraw();}}finally{locked.forEach((el,i)=>el.disabled=disabled[i]);$('animation-stop').disabled=true;active=null;signal?.removeEventListener('abort',abort);}}
  if(save)download(blob,'simulation-deformation.gif');message('表示用変形GIFを作成しました。','Visual deformation GIF frames created.');return blob;
 }
 const renderGif=options=>options.animation==='time'?renderStoredTimeGif(options):options.animation==='deformation'?renderDeformationGif(options):renderOrbitGif(options);
 $('animation-gif-save').onclick=()=>renderGif({animation:$('animation-kind').value,seconds:Number($('animation-seconds').value),save:true}).catch(error=>message(error.message,error.message));

  // Same checks renderSequence runs, exposed so the job layer can refuse at start instead of failing after the job began.
 function preflight({animation='orbit',view,format,seconds=5}={}){
  if(format==='gif'){if(animation==='deformation'){const output=getAnalysis();createSingleDeformationGifPlan(output,seconds,view?.result?.field??$('result-field')?.value,view?.result?.deformScale??Number($('deform-scale').value),output?.result?.kind==='modal'?(view?.result?.modeIndex??Number($('result-mode')?.value)):null);if(!singleDeformationGifCapabilities(recordingEnv).supported)throw Error('Deformation GIF canvas unavailable');return;}if(animation==='time'){createSingleStoredTimeGifPlan(getAnalysis(),seconds,view?.result?.field??$('result-field')?.value);if(!singleStoredTimeGifCapabilities(recordingEnv).supported)throw Error('Stored-time GIF canvas unavailable');return;}if(animation!=='orbit')throw Error('Single-view GIF supports orbit or stored time only');if(!getAnalysis()?.result)throw Error('Display a result before exporting GIF');if(!singleOrbitGifCapabilities(recordingEnv).supported)throw Error('Orbit GIF canvas support is unavailable');return;}
  if(format==='webm'&&animation==='time'){const output=getAnalysis(),thermal=output?.result?.kind==='thermal';if(thermal)createSingleViewThermalTimePlan(output,seconds,view?.result?.field??$('result-field')?.value);else createSingleViewAcousticTimePlan(output,seconds);const cap=(thermal?singleThermalTimeWebmCapabilities:singleViewTimeWebmCapabilities)(recordingEnv);if(!cap.supported)throw Object.assign(Error(cap.reason),{code:'WEBM_FIXED_UNSUPPORTED'});return;}
  const output=getAnalysis(),result=output?.result;
  if(!FIXED_FRAME_ANIMATIONS.includes(animation))throw Error('Invalid animation type');
  if(animation==='deformation'&&!['elastic','modal'].includes(result?.kind))throw Error('Deformation requires a structural or modal result.');
  if(animation==='time'){
   const stored=framesOf(result);if(!stored||!$('acoustic-time-frame'))throw Error('Time playback requires stored transient acoustic or thermal frames.');
   if(result.kind==='thermal'){
    if((view?.result?.field??$('result-field')?.value)!=='temperature')throw Error('Thermal time export requires temperature; heat flux is final-step only.');
    const count=output.mesh?.nodes?.length/3;
    if(!Number.isInteger(count)||stored.fields.some(values=>!Array.isArray(values)||values.length!==count||!values.every(Number.isFinite)))throw Error('Invalid stored thermal temperatures');
   }
   fixedFrameSchedule({animation:'time',frames:2,state:animationState,snapshotTimes:stored.times});
  }
  if(animation==='slice'&&!output?.mesh)throw Error('Generate a volume mesh first.');
 }
 // Fixed-frame PNG sequence: frame i is rendered from the stored view state for index i of N; wall-clock time and tab throttling never enter the result.
 async function renderSequence({animation='orbit',frames=FIXED_FRAME_LIMITS.defaultFrames,view={},expectedResultRevision,physicalRevision,signal,onProgress=()=>{}}){
  if(signal?.aborted)throw Error('Export cancelled');
  validateFrameCount(frames);
  if(typeof crypto==='undefined'||!crypto.subtle?.digest)throw Error('png-sequence export requires SHA-256 support');
  if(!FIXED_FRAME_ANIMATIONS.includes(animation))throw Error('Invalid animation type');
  preflight({animation,view});
  const output=getAnalysis(),result=output?.result,time=$('acoustic-time-frame');
  const axis=Number($('clip-axis').value),nodes=output?.mesh?.nodes||[],coordinates=nodes.filter((_,i)=>i%3===axis),min=coordinates.length?Math.min(...coordinates):0,max=coordinates.length?Math.max(...coordinates):1;
  const saved={position:camera.position.clone(),target:controls.target.clone(),damping:controls.enableDamping,enabled:controls.enabled,scale:$('deform-scale').value,clip:$('clip-enabled').checked,plane:$('clip-position').value,time:time?.value,timeView:getTimeView?.()};
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
    records.push({...step,file:name,...(physicalRevision?{physicalRevision}:{resultRevision:expectedResultRevision}),width,height,bytes:bytes.length,sha256:'sha256:'+await sha256Hex(bytes),...(animation==='orbit'?{camera:{position:orbitCameraPosition(startPosition,startTarget,step.angleRadians)}}:{})});
    if(signal?.aborted||state.stop)throw Error('Export cancelled');
    onProgress({fraction:(step.index+1)/frames*.98});
   }
   const manifest={schemaVersion:physicalRevision?2:1,kind:'airpocket-fixed-frame-png-sequence',...(physicalRevision?{physicalRevision}:{resultRevision:expectedResultRevision}),animation,frameCount:frames,resolution,
    schedule:{basis:'fixed',timeBasis:animation==='time'?(result.kind==='thermal'?'stored thermal temperature frames':'stored acoustic frames'):'frame index',...(animation==='time'?{resultKind:result.kind,field:result.kind==='thermal'?'temperature':'instantPressure'}:{}),phase:animation==='orbit'||animation==='deformation'?'index/frameCount':'index/(frameCount-1)',realtime:false,wallClockIndependent:true},
    view:pickViewFields(view),scale:{units:{time:'second',angle:'radian'},...(animation==='deformation'?{deformScaleKind:'visualization multiplier'}:{})},frames:records};
   const manifestBytes=new TextEncoder().encode(JSON.stringify(manifest,null,1));
   if(signal?.aborted||state.stop)throw Error('Export cancelled');
   const zip=buildStoreZip([{name:'manifest.json',bytes:manifestBytes},...entries]);onProgress({fraction:1});
   return new Blob([zip],{type:'application/zip'});
  }finally{
   try{camera.position.copy(saved.position);camera.lookAt(saved.target);controls.target.copy(saved.target);controls.enabled=saved.enabled;controls.enableDamping=saved.damping;$('deform-scale').value=saved.scale;$('clip-enabled').checked=saved.clip;$('clip-position').value=saved.plane;
    try{if(time&&animation==='time'&&getAnalysis()===output){if(restoreTimeView&&saved.timeView!==undefined)restoreTimeView(saved.timeView);else{time.value=saved.time;time.dispatchEvent(new Event('input'));}}if(getAnalysis()===output&&output)redraw();$('clip-position').dispatchEvent(new Event('input'));}finally{locked.forEach((el,i)=>{el.disabled=disabled[i];});active=null;}}
   catch(error){active=null;throw error;}
  }
 }
 async function render({format,animation,seconds,frames,view,expectedResultRevision,physicalRevision,signal,onProgress=()=>{}}){
  if(active||!$('cancel-run').disabled)throw Error('Viewer is busy');
  if(signal?.aborted)throw Error('Export cancelled');
  if(format==='gif')return renderGif({animation,seconds,signal,onProgress,expectedResultRevision});
  if(format==='png-sequence')return renderSequence({animation,frames,view,expectedResultRevision,physicalRevision,signal,onProgress});
  if(format==='webm')return animate(true,{animation,seconds,signal,onProgress,save:false,expectedResultRevision});
  if(format!=='png')throw Error('Unsupported export format');
  const state={stop:false};active=state;const locked=[...document.querySelectorAll('#app button,#app input,#app select,aside summary')].filter(el=>el.id!=='agent-disconnect'&&!el.closest?.('#agent-connection')),disabled=locked.map(el=>el.disabled);locked.forEach(el=>{el.disabled=true;});
  try{message('表示中の画像','Current view');const frame=capture();onProgress({fraction:0});const blob=await new Promise((resolve,reject)=>frame.toBlob(value=>value?resolve(value):reject(Error('Image capture failed')),'image/png'));if(signal?.aborted||state.stop)throw Error('Export cancelled');onProgress({fraction:1});return blob;}finally{locked.forEach((el,i)=>{el.disabled=disabled[i];});active=null;}
 }
 const pngSequenceSupported=()=>typeof crypto!=='undefined'&&!!crypto.subtle?.digest;
 const pngSequenceCapability=()=>pngSequenceSupported()?{supported:true,container:'zip',compression:'store',...FIXED_FRAME_LIMITS,animations:[...FIXED_FRAME_ANIMATIONS],timeSelection:'stored-frames-only',timeAnimationResultKinds:['acousticTransient','thermal'],thermalTimeField:'temperature',recording:'fixed-frame',realtime:false,wallClockIndependent:true,frameCountGuaranteed:true,manifest:'manifest.json (physicalRevision, per-frame phase/angle/time, resolution, SHA-256)'}:{supported:false,reason:'SHA-256 (crypto.subtle) is unavailable',alternatives:['png']};
 const capabilities=({mediaRecorder=typeof MediaRecorder==='undefined'?undefined:MediaRecorder}={})=>{const formats=exportFormatCapabilities({mediaRecorder,...recordingEnv});formats['png-sequence']=pngSequenceCapability();return {schemaVersion:1,singleOrbitGifExport:singleOrbitGifCapabilities(recordingEnv),singleStoredTimeGifExport:singleStoredTimeGifCapabilities(recordingEnv),singleDeformationGifExport:singleDeformationGifCapabilities(recordingEnv),singleTimeWebmExport:singleViewTimeWebmCapabilities(recordingEnv),singleThermalTimeWebmExport:singleThermalTimeWebmCapabilities(recordingEnv),png:true,'png-sequence':pngSequenceSupported(),webm:!!mediaRecorder&&!!canvas.captureStream&&WEBM_TYPES.some(type=>safeSupported(mediaRecorder,type)),mp4:formats.mp4.supported,gif:formats.gif.supported,formats,animations:['orbit','deformation','time','slice'],timeSelection:'stored-acoustic-frames-only',timeAnimationResultKinds:['acousticTransient'],stillTime:'displayed-time-recorded-for-thermal',recording:'realtime',targetFrameRate:24,frameCountGuaranteed:false,maxSeconds:15};};
 return {stop,capture,render,preflight,capabilities,isActive:()=>active!==null};
}
