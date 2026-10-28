import {createIncrementCurveArtifacts} from '../increment-curve-export.js';

export const INCREMENT_CURVE_UI_MAX_BYTES=1024*1024;
const messages={
 '段階データの静止グラフ':'Static increment curves',
 '独立した線形弾性結果の標点伸び（mm）と反力由来の引張力（N）です。塑性の載荷・除荷履歴ではありません。未収束・失敗段階の線はつなぎません。':'Gauge extension (mm) and reaction-derived tensile force (N) from independent linear-elastic results. This is not a plastic load/unload history. Unconverged or failed steps break the line.',
 'specとstepsを含むJSON（最大1MiB）':'JSON containing spec and steps (maximum 1 MiB)',
 '段階データJSONファイル':'Increment bundle JSON file',
 '検証して静止グラフを表示':'Validate and show static curve',
 'CSVを保存':'Save CSV','JSONを保存':'Save JSON','SVGを保存':'Save SVG',
 '入力から再計算して検証します。自己申告のcurveや画像は受け付けません。現在の入力・ケース・解析結果は変更しません。':'Recomputes and validates from supplied inputs. Self-reported curves or images are refused. The current project, cases and analysis result are unchanged.',
 '段階グラフの使い方':'Increment curve instructions',
 'サンプルJSONを保存':'Save sample JSON',
 '合成の単一Tet4参照です。サンプルJSONを保存し、ファイル欄で読み込んで検証してください。実測や塑性履歴ではありません。':'Synthetic single-Tet4 reference. Save the sample JSON, select it in the file field and validate. This is not measured data or plastic history.',
 '未検証です。検証後に保存できます。':'Not validated. Validate before downloading.',
 '入力が変更されました。再検証してください。':'Input changed. Validate again.',
 '検証中…':'Validating…','検証済み。力 N、標点伸び mm、工学応力 Pa、工学ひずみ 1。':'Validated. Force N; gauge extension mm; engineering stress Pa; engineering strain 1.',
 '検証できません: ':'Validation refused: ',
 'JSONは最大1MiBです。':'JSON must not exceed 1 MiB.',
 '静止SVGグラフ。標点伸び mm、引張力 N。':'Static SVG curve: gauge extension mm, tensile force N.'
};

// Presentation only. Always derive artifacts from the strict shared service;
// caller-provided curve rows/SVG never become a drawing or a download.
export function createIncrementCurveUi({anchor,document=globalThis.document,language=()=> 'ja',translate=()=>{},env={}}={}){
 if(!anchor||!document?.createElement)throw TypeError('Increment curve UI requires a host');
 translate(messages);const tr=text=>language()==='en'?(messages[text]??text):text;
 const url=env.URL??globalThis.URL,BlobType=env.Blob??globalThis.Blob;
 const labels=[];const el=(tag,id,text)=>{const node=document.createElement(tag);if(id)node.id=id;if(tag==='a'){node.style.color='#67e8d9';node.style.textDecoration='underline';node.style.textUnderlineOffset='3px';}if(text){labels.push([node,text]);node.textContent=tr(text);}return node;};
 const host=el('details','increment-curve-panel'),summary=el('summary',null,'段階データの静止グラフ');
 host.style.minWidth='0';host.setAttribute('data-no-translate','true');
 const note=el('p',null,'独立した線形弾性結果の標点伸び（mm）と反力由来の引張力（N）です。塑性の載荷・除荷履歴ではありません。未収束・失敗段階の線はつなぎません。');
 const input=el('textarea','increment-curve-input');input.rows=7;input.style.width='100%';input.style.maxWidth='100%';input.style.boxSizing='border-box';input.maxLength=INCREMENT_CURVE_UI_MAX_BYTES;
 const file=el('input','increment-curve-file');file.type='file';file.accept='.json,application/json';file.style.maxWidth='100%';
 const label=(text,control)=>{const node=el('label'),caption=el('span',null,text);node.append(caption,control);return node;};
 const run=el('button','increment-curve-run','検証して静止グラフを表示');run.type='button';
 const status=el('p','increment-curve-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');input.setAttribute('aria-describedby',status.id);file.setAttribute('aria-describedby',status.id);
 const preview=el('img','increment-curve-preview');preview.hidden=true;preview.style.width='100%';preview.style.maxWidth='100%';preview.style.height='auto';
 const downloads=el('div','increment-curve-downloads');downloads.style.display='flex';downloads.style.flexWrap='wrap';downloads.style.gap='8px';
 const links={};for(const [kind,text]of [['csv','CSVを保存'],['json','JSONを保存'],['svg','SVGを保存']]){const link=el('a','increment-curve-'+kind,text);link.hidden=true;link.download='increment-curve.'+kind;links[kind]=link;downloads.append(link);}
 const instructions=el('a',null,'段階グラフの使い方');instructions.target='_blank';instructions.rel='noopener';
 const sample=el('a','increment-curve-sample','サンプルJSONを保存');sample.href='./examples/increment-curve-reference.json';sample.download='increment-curve-reference.json';
 host.append(summary,note,sample,el('p',null,'合成の単一Tet4参照です。サンプルJSONを保存し、ファイル欄で読み込んで検証してください。実測や塑性履歴ではありません。'),label('specとstepsを含むJSON（最大1MiB）',input),label('段階データJSONファイル',file),run,el('p',null,'入力から再計算して検証します。自己申告のcurveや画像は受け付けません。現在の入力・ケース・解析結果は変更しません。'),instructions,status,preview,downloads);anchor.after(host);
 let epoch=0,urls=[],message='未検証です。検証後に保存できます。',errorDetail='',counts=null;
 const refresh=()=>{for(const [node,text]of labels)node.textContent=tr(text);status.textContent=tr(message)+errorDetail+(counts?(language()==='en'?` Steps: ${counts.total}; failed gaps: ${counts.failed}.`:` 段階: ${counts.total}、失敗による空白: ${counts.failed}。`):'');preview.alt=tr('静止SVGグラフ。標点伸び mm、引張力 N。');instructions.href='https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/main/docs/'+(language()==='en'?'en/':'')+'increment-curve-ui.md';};
 const clear=()=>{epoch++;for(const value of urls)url.revokeObjectURL(value);urls=[];counts=null;for(const link of Object.values(links)){link.hidden=true;link.removeAttribute('href');}preview.hidden=true;preview.removeAttribute('src');run.disabled=false;for(const control of [input,file]){control.removeAttribute('aria-invalid');control.removeAttribute('aria-errormessage');}errorDetail='';};
 const invalidate=()=>{clear();message='入力が変更されました。再検証してください。';refresh();};
 const bounded=text=>{if(typeof text!=='string'||text.length>INCREMENT_CURVE_UI_MAX_BYTES||new TextEncoder().encode(text).length>INCREMENT_CURVE_UI_MAX_BYTES)throw Error(tr('JSONは最大1MiBです。'));return text;};
 const fail=(error,control)=>{message='検証できません: ';errorDetail=String(error?.message??error).slice(0,1000);control.setAttribute('aria-invalid','true');control.setAttribute('aria-errormessage',status.id);refresh();control.focus?.();};
 async function validate(){clear();const current=epoch;run.disabled=true;message='検証中…';refresh();
  try{
   const artifacts=await createIncrementCurveArtifacts(JSON.parse(bounded(input.value)));
   if(current!==epoch)return null;
   const types={csv:'text/csv;charset=utf-8',json:'application/json',svg:'image/svg+xml'};
   for(const kind of ['csv','json','svg']){const href=url.createObjectURL(new BlobType([artifacts[kind]],{type:types[kind]}));urls.push(href);links[kind].href=href;links[kind].hidden=false;}
   preview.src=links.svg.href;preview.hidden=false;counts={total:artifacts.curve.steps.length,failed:artifacts.curve.steps.filter(step=>step.status==='failed').length};message='検証済み。力 N、標点伸び mm、工学応力 Pa、工学ひずみ 1。';refresh();return artifacts.curve;
  }catch(error){if(current===epoch){clear();fail(error,input);}return null;}finally{if(current===epoch)run.disabled=false;}
 }
 run.onclick=()=>validate();input.oninput=()=>{file.value='';invalidate();};
 file.onchange=async()=>{clear();input.value='';const current=epoch;run.disabled=true;message='入力が変更されました。再検証してください。';refresh();try{const selected=file.files?.[0];if(!selected)return;if(!Number.isSafeInteger(selected.size)||selected.size<0||selected.size>INCREMENT_CURVE_UI_MAX_BYTES)throw Error(tr('JSONは最大1MiBです。'));const text=bounded(await selected.text());if(current!==epoch)return;input.value=text;}catch(error){if(current===epoch)fail(error,file);}finally{if(current===epoch)run.disabled=false;}};
 document.addEventListener?.('studio-language',refresh);refresh();
 return {host,validate,clear:invalidate,destroy(){clear();document.removeEventListener?.('studio-language',refresh);host.remove?.();}};
}
