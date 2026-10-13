// Capture the rendered view without changing the archived analysis fields.
export function animationState(kind,phase,{scale=1,frames=1,min=0,max=1}={}){
 if(!['orbit','deformation','time','slice'].includes(kind)||!Number.isFinite(phase)||phase<0||phase>1||!Number.isFinite(scale)||scale<0||!Number.isInteger(frames)||frames<1||!Number.isFinite(min)||!Number.isFinite(max)||max<min)throw Error('Invalid animation settings');
 return {angle:phase*2*Math.PI,deformScale:scale*(1-Math.cos(phase*2*Math.PI))/2,frame:Math.min(frames-1,Math.floor(phase*frames)),position:min+(max-min)*phase};
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
  const lines=['Airpocket Simulation Studio · '+$('name').textContent,$('result-legend').textContent,$('section-summary').textContent,$('visual-export-status').textContent];
  lines.forEach((text,i)=>context.fillText(text,16,h+23+23*i,w-32));return canvas;
 }
 function download(blob,name){if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(blob);const link=$('visual-export-download');link.href=downloadUrl;link.download=name;link.textContent=language()==='en'?'Download again':'もう一度ダウンロード';link.hidden=false;link.click();}
 const stop=()=>{if(active)active.stop=true;};$('animation-stop').onclick=stop;
 $('view-png').onclick=()=>{try{message('表示中の画像','Current view');capture().toBlob(blob=>{if(blob)download(blob,'simulation-view.png');else message('画像を作成できませんでした。','Image capture failed.');},'image/png');}catch(error){message(error.message,error.message);}};
 async function animate(record){
  if(active)throw Error(language()==='en'?'Playback is already active.':'再生中です。');
  if(!$('cancel-run').disabled)throw Error(language()==='en'?'Wait for analysis to finish.':'解析の完了を待ってください。');
  const kind=$('animation-kind').value,seconds=Number($('animation-seconds').value),output=getAnalysis(),result=output?.result;
  if(!Number.isInteger(seconds)||seconds<1||seconds>15)throw Error(language()==='en'?'Duration must be 1–15 seconds.':'長さは1～15秒で指定してください。');
  if(kind==='deformation'&&!['elastic','modal'].includes(result?.kind))throw Error(language()==='en'?'Deformation requires a structural or modal result.':'変形には構造または固有振動の結果が必要です。');
  const time=$('acoustic-time-frame');
  if(kind==='time'&&(result?.kind!=='acousticTransient'||!time))throw Error(language()==='en'?'Time playback requires transient acoustic frames.':'時間変化には過渡音響の結果が必要です。');
  if(kind==='slice'&&!output?.mesh)throw Error(language()==='en'?'Generate a volume mesh first.':'先に体積メッシュを生成してください。');
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(type));
  if(record&&(!mime||!canvas.captureStream))throw Error(language()==='en'?'WebM recording is unavailable in this browser.':'このブラウザはWebM録画に対応していません。');
  const axis=Number($('clip-axis').value),nodes=output?.mesh?.nodes||[],coordinates=nodes.filter((_,i)=>i%3===axis),saved={position:camera.position.clone(),target:controls.target.clone(),damping:controls.enableDamping,enabled:controls.enabled,scale:$('deform-scale').value,clip:$('clip-enabled').checked,plane:$('clip-position').value,time:time?.value},state={stop:false};
  active=state;controls.enabled=false;controls.enableDamping=false;message('再生を開始しています。','Starting playback.');
  const locked=[...document.querySelectorAll('#app button,#app input,#app select,aside summary')].filter(el=>el.id!=='animation-stop'),disabled=locked.map(el=>el.disabled);
  locked.forEach(el=>{el.disabled=true;});$('animation-stop').disabled=false;
  let recorder,stream,chunks=[],finished;
  try{
   if(record){capture();stream=canvas.captureStream(24);recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});finished=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||Error('Recording failed'));});recorder.start();}
   const started=performance.now(),offset=saved.position.clone().sub(saved.target);
   await new Promise((resolve,reject)=>{function tick(now){try{const phase=Math.max(0,Math.min(1,(now-started)/(seconds*1000))),s=animationState(kind,phase,{scale:Number(saved.scale),frames:result?.snapshots?.length||1,min:coordinates.length?Math.min(...coordinates):0,max:coordinates.length?Math.max(...coordinates):1});if(getAnalysis()!==output||state.stop){resolve();return;}
    if(kind==='orbit'){camera.position.copy(offset).applyAxisAngle({x:0,y:1,z:0},s.angle).add(saved.target);camera.lookAt(saved.target);}
    else if(kind==='deformation'){$('deform-scale').value=s.deformScale;redraw();}
    else if(kind==='time'){time.value=s.frame;time.dispatchEvent(new Event('input'));}
    else {$('clip-enabled').checked=true;$('clip-position').value=s.position;$('clip-position').dispatchEvent(new Event('input'));}
    message(kind==='time'?'表示時間 '+result.snapshots[s.frame].time.toPrecision(5)+' s（動画は表示用の時間尺度）':kind==='deformation'?'表示用の変形往復 · 倍率 '+s.deformScale.toPrecision(4):'アニメーション '+kind+' · '+Math.round(phase*100)+'%',kind==='time'?'Physical time '+result.snapshots[s.frame].time.toPrecision(5)+' s (visualization time scale)':kind==='deformation'?'Visual deformation cycle · scale '+s.deformScale.toPrecision(4):'Animation '+kind+' · '+Math.round(phase*100)+'%');capture();if(phase>=1)resolve();else requestAnimationFrame(tick);
   }catch(error){reject(error);}}requestAnimationFrame(tick);});
  }finally{
   try{if(recorder&&recorder.state!=='inactive')recorder.stop();if(finished)await finished;}
   finally{stream?.getTracks().forEach(track=>track.stop());camera.position.copy(saved.position);camera.lookAt(saved.target);controls.target.copy(saved.target);controls.enabled=saved.enabled;controls.enableDamping=saved.damping;$('deform-scale').value=saved.scale;$('clip-enabled').checked=saved.clip;$('clip-position').value=saved.plane;try{if(time){time.value=saved.time;time.dispatchEvent(new Event('input'));}if(getAnalysis()===output&&output)redraw();$('clip-position').dispatchEvent(new Event('input'));}finally{locked.forEach((el,i)=>{el.disabled=disabled[i];});$('animation-stop').disabled=true;active=null;}}
  }
  if(record&&chunks.length)download(new Blob(chunks,{type:mime}),'simulation-'+kind+'.webm');message(state.stop?'再生を停止しました。':'再生が完了しました。',state.stop?'Playback stopped.':'Playback completed.');
 }
 for(const [id,record]of [['animation-preview',false],['animation-save',true]])$(id).onclick=()=>animate(record).catch(error=>message(error.message,error.message));
 return {stop,capture};
}
