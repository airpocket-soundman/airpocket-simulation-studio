import {printedIdentificationExample} from '../printed-identification-examples.js';
import {PRINTED_DATASET_LIMITS} from '../printed-measurement-dataset.js';
export const PRINTED_IDENTIFICATION_UI_LIMITS=Object.freeze({workerMilliseconds:10000,responseBytes:262144});
const models=['linear-elastic','bilinear-elastic-plastic','sls-relaxation'];
const keys={
 'linear-elastic':['youngsModulusPa'],
 'bilinear-elastic-plastic':['youngsModulusPa','yieldStressPa','tangentModulusPa'],
 'sls-relaxation':['equilibriumModulusPa','branchModulusPa','relaxationTimeS']
};
const text={
 examples:['合成例と条件を入力（実測ではない・自動実行なし）','Load synthetic example and conditions (not measured; no automatic run)'],toy:['架空のアルゴリズム確認例です。材料の推奨値ではありません。','Invented algorithm example; not recommended material properties.'],
 title:['小ひずみパラメータを同定（読取専用）','Identify small-strain parameters (read only)'],
 note:['未校正・精度未検証。材料や解析入力へ適用しません。必須条件をすべて明示してください。標準誤差はモデル条件付き近似で、測定精度ではありません。','Uncalibrated; accuracy unverified. Results are not applied to materials or analysis inputs. Enter every required condition. Standard errors are conditional model approximations, not measurement accuracy.'],
 model:['モデル','Model'],choose:['モデルを選択','Choose a model'],
 'linear-elastic':['線形弾性（原点通過）','Linear elastic (through origin)'],
 'bilinear-elastic-plastic':['連続二直線（正の接線、単調載荷・窓内512点まで）','Continuous bilinear (positive tangent, monotonic loading; at most512 window points)'],
 'sls-relaxation':['一分岐SLS応力緩和','One-branch SLS stress relaxation'],
 maxStrain:['最大工学ひずみ (1)','Maximum engineering strain (1)'],minPoints:['最小点数（3以上、SLS保持は4点以上）','Minimum points (at least3; SLS hold at least4)'],maxRelativeStandardError:['許容相対標準誤差 (1)','Maximum relative standard error (1)'],maxTangentRatio:['接線係数 / 弾性係数の上限 (0〜1未満)','Maximum tangent / elastic modulus ratio (strictly between0 and1)'],holdStrainTolerance:['保持ひずみの相対許容差 (1)','Relative held-strain tolerance (1)'],
 run:['同定する','Identify'],cancel:['同定を取消','Cancel identification'],clear:['同定条件をクリア','Clear identification conditions'],
 idle:['未実行。既存の測定JSONを使います。必要条件に既定値はありません。','Not run. Uses the measurement JSON above. Required conditions have no defaults.'],pending:['専用処理で同定しています…','Identifying in a dedicated worker…'],invalid:['同定できません。JSON・必須条件・単位・容量を確認してください。','Cannot identify. Check JSON, required conditions, units and size.'],timeout:['処理時間の上限に達したため専用処理を終了しました。','Time limit reached; the dedicated worker was terminated.'],cancelled:['同定を取り消しました。','Identification cancelled.'],completed:['同定結果（材料への適用なし）','Identification results (not applied to material)'],unsupported:['この環境では専用処理を開始できません。','A dedicated worker is unavailable in this environment.'],
 synthetic:['合成データ・実測ではありません','Synthetic data; not a measurement'],measured:['実測と申告されたデータ・精度未検証','Reported measured data; accuracy unverified'],rejected:['同定不能','Not identified'],youngsModulusPa:['ヤング率','Young modulus'],yieldStressPa:['降伏応力','Yield stress'],tangentModulusPa:['接線係数','Tangent modulus'],equilibriumModulusPa:['平衡弾性係数','Equilibrium modulus'],branchModulusPa:['分岐弾性係数','Branch modulus'],relaxationTimeS:['緩和時間','Relaxation time'],se:['標準誤差','Standard error'],rse:['相対標準誤差','Relative standard error'],scatter:['試験片間の平均 / 標本標準偏差','Across-specimen mean / sample standard deviation']
};
const reasons={
 'too-few-points':['条件内の点数が不足しています','Too few points in the declared window'],
 'degenerate-strain-span':['ひずみの変化が不足しています','Insufficient strain variation'],
 'nonpositive-modulus':['正の弾性係数を得られません','No positive modulus'],
 'modulus-not-resolved':['弾性係数の不確かさが条件を超えています','Modulus uncertainty exceeds the condition'],
 'non-monotonic-loading':['単調載荷ではありません','Loading is not monotonic'],
 'bilinear-point-budget-exceeded':['二直線の窓内点数が上限512点を超えています','Bilinear window exceeds the512-point limit'],
 'yield-at-window-edge':['降伏点が窓端にあり識別できません','Yield lies at the fitting-window edge'],
 'nonpositive-tangent-modulus':['正の接線係数を得られません','No positive tangent modulus'],
 'no-distinct-yield':['明確な降伏を識別できません','No distinct yield is resolved'],
 'yield-not-resolved':['降伏の不確かさが条件を超えています','Yield uncertainty exceeds the condition'],
 'no-held-strain':['正の保持ひずみがありません','No positive held strain'],
 'held-strain-outside-window':['保持ひずみが指定した最大ひずみを超えています','Held strain exceeds maximum strain'],
 'hold-not-constant':['保持ひずみが一定でないか、保持点数が不足しています','Hold is not constant or has insufficient points'],
 'relaxation-time-outside-window':['緩和時間が観測窓外です','Relaxation time is outside the observation window'],
 'degenerate-relaxation':['緩和係数を独立に識別できません','Relaxation parameters cannot be independently resolved'],
 'relaxation-not-resolved':['緩和係数の不確かさが条件を超えています','Relaxation uncertainty exceeds the condition'],
 'nonfinite-fit':['有限な同定診断を得られません','No finite fitting diagnostics'],
 'parameters-not-resolved':['係数の不確かさが条件を超えています','Parameter uncertainty exceeds the condition']
};
const exact=(o,names)=>!!o&&typeof o==='object'&&!Array.isArray(o)&&[Object.prototype,null].includes(Object.getPrototypeOf(o))&&Reflect.ownKeys(o).length===names.length&&names.every(k=>{const d=Object.getOwnPropertyDescriptor(o,k);return d&&Object.hasOwn(d,'value')&&d.enumerable;});
const dense=a=>Array.isArray(a)&&Object.getPrototypeOf(a)===Array.prototype&&Reflect.ownKeys(a).length===a.length+1&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)&&Object.hasOwn(Object.getOwnPropertyDescriptor(a,String(i)),'value')).every(Boolean);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const short=x=>typeof x==='string'&&x.length>0&&x.length<=200;
function validResult(r,options,hash){
 if(!exact(r,['identificationVersion','model','options','dataset','calibrated','accuracyVerified','identified','specimens','across'])||r.identificationVersion!==1||r.model!==options.model||r.calibrated!==false||r.accuracyVerified!==false||typeof r.identified!=='boolean'||!exact(r.options,Object.keys(options))||Object.keys(options).some(k=>r.options[k]!==options[k]))return false;
 if(!exact(r.dataset,['id','revision','provenance','sourceSha256'])||!short(r.dataset.id)||!short(r.dataset.revision)||!['synthetic','measured'].includes(r.dataset.provenance)||r.dataset.sourceSha256!==hash||!Array.isArray(r.specimens)||r.specimens.length<1||r.specimens.length>100||!dense(r.specimens))return false;
 const ids=new Set();let count=0;
 for(const s of r.specimens){
  if(!s||typeof s!=='object'||!exact(s,Object.keys(s))||!short(s.specimen)||ids.has(s.specimen)||typeof s.identified!=='boolean')return false;ids.add(s.specimen);
  if(!s.identified){const allowed=['specimen','identified','reason','points','relativeStandardError','yieldStrain','tangentToElasticRatio','relaxationTimeS'];if(!exact(s,Object.keys(s))||Object.keys(s).some(k=>!allowed.includes(k))||typeof s.reason!=='string'||!Object.hasOwn(reasons,s.reason)||Object.keys(s).some(k=>!['specimen','identified','reason'].includes(k)&&!finite(s[k])))return false;continue;}
  const extra=options.model==='bilinear-elastic-plastic'?['yieldStrain','residualSsReductionVsLinear']:options.model==='sls-relaxation'?['heldStrain']:[];
  if(!exact(s,['specimen','identified','points','parameters','rSquared','residualRmsPa',...extra])||extra.some(k=>!finite(s[k])))return false;
  count++;
  if(!Number.isInteger(s.points)||s.points<options.minPoints||s.points>(options.model==='bilinear-elastic-plastic'?512:10000)||options.model==='sls-relaxation'&&s.points<4||!finite(s.rSquared)||s.rSquared>1||!finite(s.residualRmsPa)||s.residualRmsPa<0||!exact(s.parameters,keys[options.model]))return false;
  if(options.model==='bilinear-elastic-plastic'&&(s.points<2*options.minPoints||!(s.yieldStrain>0&&s.yieldStrain<=options.maxStrain)||s.residualSsReductionVsLinear>1))return false;
  if(options.model==='sls-relaxation'&&!(s.heldStrain>0&&s.heldStrain<=options.maxStrain))return false;
  for(const p of Object.values(s.parameters))if(!exact(p,['value','standardError','relativeStandardError'])||!finite(p.value)||p.value<=0||!finite(p.standardError)||p.standardError<0||!finite(p.relativeStandardError)||p.relativeStandardError<0||p.relativeStandardError>options.maxRelativeStandardError||p.relativeStandardError!==Math.abs(p.standardError/p.value))return false;
  if(options.model==='bilinear-elastic-plastic'&&(!(s.parameters.tangentModulusPa.value<s.parameters.youngsModulusPa.value*options.maxTangentRatio)||s.parameters.yieldStressPa.value!==s.parameters.youngsModulusPa.value*s.yieldStrain))return false;
 }
 if(r.identified!==(count===r.specimens.length))return false;
 if(count<2)return r.across===null;
 if(!exact(r.across,keys[options.model]))return false;
 return Object.entries(r.across).every(([key,a])=>{if(!exact(a,['mean','sampleStandardDeviation','specimens'])||!finite(a.mean)||a.mean<=0||!finite(a.sampleStandardDeviation)||a.sampleStandardDeviation<0||a.specimens!==count)return false;const values=r.specimens.filter(s=>s.identified).map(s=>s.parameters[key].value),mean=values.reduce((total,x)=>total+x/count,0),sd=Math.hypot(...values.map(x=>(x-mean)/Math.sqrt(count-1)));return a.mean===mean&&a.sampleStandardDeviation===sd;});
}
export function createPrintedIdentificationUi({host,document:doc=globalThis.document,language=()=> 'ja',getRaw,loadRaw,createWorker=()=>new Worker(new URL('../printed-identification.worker.js',import.meta.url),{type:'module'}),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const el=(tag,value)=>{const n=doc.createElement(tag);if(value!==undefined)n.textContent=value;return n;},panel=el('details'),title=el('summary'),note=el('p'),model=el('select'),modelLabel=el('label'),run=el('button'),cancel=el('button'),clear=el('button'),status=el('p'),results=el('div'),inputs={},labels={};
 const exampleNote=el('p'),exampleButtons=models.map(name=>{const button=el('button');button.type='button';button.datasetModel=name;return button;});
 const prefix=host.id||'printed-identification';panel.id=prefix+'-panel';run.id=prefix+'-run';cancel.id=prefix+'-cancel';clear.id=prefix+'-clear';status.id=prefix+'-status';results.id=prefix+'-results';model.id=prefix+'-model';modelLabel.htmlFor=model.id;panel.style.overflowWrap='anywhere';panel.style.minWidth='0';results.style.maxWidth='100%';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 for(const name of ['',...models]){const option=el('option');option.value=name;model.append(option);}model.value='';panel.append(title,note,exampleNote,...exampleButtons,modelLabel,model);
 for(const key of ['maxStrain','minPoints','maxRelativeStandardError','maxTangentRatio','holdStrainTolerance']){const label=el('label'),input=el('input');input.id=prefix+'-'+key;input.type='number';input.step=key==='minPoints'?'1':'any';input.value='';input.maxLength=64;input.style.width='100%';input.style.boxSizing='border-box';label.htmlFor=input.id;inputs[key]=input;labels[key]=label;panel.append(label,input);}
 run.type=cancel.type=clear.type='button';panel.append(run,cancel,clear,status,results);host.append(panel);
 let active=true,generation=0,phase='idle',report=null,owned=null,digestPending=false;
 const tr=k=>text[k][language()==='en'?1:0],number=x=>Number(x.toPrecision(8)).toString();
 function draw(){title.textContent=tr('title');note.textContent=tr('note');exampleNote.textContent=tr('examples')+' '+tr('toy');exampleNote.hidden=typeof loadRaw!=='function';for(let i=0;i<exampleButtons.length;i++){const b=exampleButtons[i];b.textContent=tr(models[i]);b.hidden=typeof loadRaw!=='function';b.disabled=typeof loadRaw!=='function';b.id=prefix+'-example-'+models[i];}modelLabel.textContent=tr('model');for(let i=0;i<model.children.length;i++)model.children[i].textContent=tr(i===0?'choose':models[i-1]);for(const k of Object.keys(inputs)){labels[k].textContent=tr(k);const visible=!['maxTangentRatio','holdStrainTolerance'].includes(k)||(k==='maxTangentRatio'?model.value==='bilinear-elastic-plastic':model.value==='sls-relaxation');labels[k].hidden=inputs[k].hidden=!visible;inputs[k].disabled=!visible;}
 run.textContent=tr('run');cancel.textContent=tr('cancel');clear.textContent=tr('clear');run.disabled=phase==='pending'||digestPending;cancel.disabled=phase!=='pending';status.textContent=tr(phase);results.replaceChildren();if(!report)return;
 const line=(name,value)=>results.append(el('p',name+': '+value));line(tr(report.dataset.provenance),report.dataset.id+' / '+report.dataset.revision);line('SHA-256',report.dataset.sourceSha256);
 for(const s of report.specimens){results.append(el('strong',s.specimen));if(!s.identified){line(tr('rejected'),reasons[s.reason][language()==='en'?1:0]);continue;}line(language()==='en'?'Points':'点数',s.points);for(const [name,p]of Object.entries(s.parameters)){const unit=name==='relaxationTimeS'?'s':'Pa';line(tr(name)+' ('+unit+')',number(p.value)+'; '+tr('se')+' '+number(p.standardError)+'; '+tr('rse')+' '+number(p.relativeStandardError));}line('R² / RMS (Pa)',number(s.rSquared)+' / '+number(s.residualRmsPa));}
 if(report.across){results.append(el('strong',tr('scatter')));for(const [name,a]of Object.entries(report.across))line(tr(name)+' ('+(name==='relaxationTimeS'?'s':'Pa')+')',number(a.mean)+' / '+number(a.sampleStandardDeviation));}
 }
 function stop(){const work=owned;if(!work)return;owned=null;clearTimer(work.timer);work.worker.onmessage=work.worker.onerror=work.worker.onmessageerror=null;try{work.worker.terminate();}finally{work.resolve(false);}}
 function invalidate(next='idle'){if(!active)return;generation++;stop();report=null;phase=next;draw();}
 const snapshot=()=>JSON.stringify([model.value,...Object.values(inputs).map(n=>n.value)]);
 function readOptions(){if(!models.includes(model.value))throw Error('model');const out={model:model.value};for(const k of ['maxStrain','minPoints','maxRelativeStandardError',...(model.value==='bilinear-elastic-plastic'?['maxTangentRatio']:model.value==='sls-relaxation'?['holdStrainTolerance']:[])]){const value=inputs[k].value;if(typeof value!=='string'||value.length>64||!value.trim())throw Error('required');const n=Number(value);if(!finite(n)||n<=0||k==='minPoints'&&(!Number.isInteger(n)||n<3||n>10000)||k==='maxTangentRatio'&&n>=1)throw Error('range');out[k]=n;}return out;}
 async function identify(){if(!active||phase==='pending'||digestPending)return false;invalidate();const token=generation,raw=getRaw(),signature=snapshot();let options;try{options=readOptions();if(typeof raw!=='string'||raw.length>PRINTED_DATASET_LIMITS.bytes)throw Error('size');}catch{phase='invalid';draw();return false;}phase='pending';digestPending=true;draw();let bytes,hash;try{bytes=new TextEncoder().encode(raw);if(bytes.length>PRINTED_DATASET_LIMITS.bytes)throw Error('size');hash=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}catch{if(active&&token===generation){phase='invalid';draw();}return false;}finally{digestPending=false;if(active)draw();}if(!active||token!==generation)return false;if(getRaw()!==raw||snapshot()!==signature){invalidate();return false;}
 return new Promise(resolve=>{let worker;try{worker=createWorker();}catch{phase='unsupported';draw();resolve(false);return;}owned={worker,resolve,timer:null};const refuse=next=>{if(!active||token!==generation||owned?.worker!==worker)return;report=null;phase=next;stop();draw();};
 worker.onmessage=event=>{if(!active||token!==generation||owned?.worker!==worker)return;if(getRaw()!==raw||snapshot()!==signature){invalidate();return;}const message=event.data;try{if(!exact(message,message?.ok===true?['requestId','ok','result']:['requestId','ok','code'])||message.requestId!==token||message.ok!==true||!validResult(message.result,options,hash)||new TextEncoder().encode(JSON.stringify(message)).length>PRINTED_IDENTIFICATION_UI_LIMITS.responseBytes){refuse('invalid');return;}}catch{refuse('invalid');return;}report=message.result;phase='completed';owned.resolve(true);stop();draw();};
 worker.onerror=event=>{event.preventDefault?.();refuse('invalid');};worker.onmessageerror=()=>refuse('invalid');owned.timer=setTimer(()=>refuse('timeout'),PRINTED_IDENTIFICATION_UI_LIMITS.workerMilliseconds);try{worker.postMessage({requestId:token,raw,options});}catch{refuse('invalid');}
 });}
 for(let i=0;i<exampleButtons.length;i++)exampleButtons[i].onclick=()=>{if(!active||typeof loadRaw!=='function')return false;invalidate();const example=printedIdentificationExample(models[i]);loadRaw(example.raw);model.value=example.options.model;for(const [key,input]of Object.entries(inputs))input.value=Object.hasOwn(example.options,key)?String(example.options[key]):'';draw();status.textContent=tr('toy');return true;};
 for(const input of [model,...Object.values(inputs)]){input.oninput=input.onchange=()=>invalidate();input.onkeydown=event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();return identify();}};}run.onclick=identify;cancel.onclick=()=>invalidate('cancelled');clear.onclick=()=>{if(!active)return;model.value='';for(const input of Object.values(inputs))input.value='';invalidate();};draw();
 return Object.freeze({panel,model,inputs,exampleButtons,run,cancel,clear,status,results,identify,invalidate,refresh:()=>{if(active)draw();},snapshot:()=>({phase,workerActive:owned!==null,digestPending,sourceSha256:report?.dataset.sourceSha256??null}),destroy(){if(!active)return;invalidate();active=false;phase='closed';for(const input of [model,...Object.values(inputs)])input.oninput=input.onchange=input.onkeydown=null;run.onclick=cancel.onclick=clear.onclick=null;for(const button of exampleButtons)button.onclick=null;panel.remove();}});
}
