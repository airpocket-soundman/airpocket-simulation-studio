import {createIncrementCurveComparison} from '../increment-curve-comparison.js';

export const INCREMENT_CURVE_COMPARISON_UI_MAX_BYTES=2*1024*1024;
const messages={
 '参照Bを保存':'Save reference B',
 '2〜4件のbundle JSONファイルを同時に選択してください。':'Select 2–4 bundle JSON files together.',
 '複数の段階グラフを比較':'Compare increment curves',
 '独立した線形弾性結果の荷重–標点伸び（mm・N）と工学SS（ひずみ1・応力Pa）の2図です。失敗段階の線はつなぎません。真応力・塑性履歴ではありません。':'Two plots from independent linear-elastic results: force–gauge extension (mm, N) and engineering stress–strain (strain 1, stress Pa). Failed steps break the line. These are not true stress or plastic histories.',
 '独立した線形弾性結果の標点伸び（mm）と反力由来の引張力（N）です。塑性の載荷・除荷履歴ではありません。未収束・失敗段階の線はつなぎません。':'Gauge extension (mm) and reaction-derived tensile force (N) from independent linear-elastic results. This is not a plastic load/unload history. Unconverged or failed steps break the line.',
 'bundlesに2〜4件を含む比較JSON（合計最大2MiB）':'Comparison JSON with 2–4 bundles (maximum total 2 MiB)',
 '段階bundle JSONファイル（2〜4件を同時選択）':'Increment bundle JSON files (select 2–4 together)',
 '検証して比較グラフを表示':'Validate and compare curves',
 'CSVを保存':'Save CSV','JSONを保存':'Save JSON','SVGを保存':'Save SVG',
 '入力から再計算して検証します。自己申告のcurveや画像は受け付けません。現在の入力・ケース・解析結果は変更しません。':'Recomputes and validates from supplied inputs. Self-reported curves or images are refused. The current project, cases and analysis result are unchanged.',
 '比較グラフの使い方':'Curve comparison instructions',
 '参照Aを保存':'Save reference A',
 '実solverの合成Tet4参照です。参照AとBを保存し、ファイル欄で2件を同時選択して検証してください。実測や塑性履歴ではありません。':'Synthetic Tet4 references from real solves. Save A and B, select both files together and validate. These are not measurements or plastic histories.',
 '色と凡例で曲線を区別します。材料・形状・標点が異なる場合も各曲線の識別を保持し、別の状態履歴へ結合しません。':'Colors and legends distinguish curves. Each curve retains its identity when material, geometry or gauge differ; curves are never joined into one state history.',
 '未検証です。検証後に保存できます。':'Not validated. Validate before downloading.',
 '入力が変更されました。再検証してください。':'Input changed. Validate again.',
 '検証中…':'Validating…','検証済み。力 N、標点伸び mm、工学応力 Pa、工学ひずみ 1。':'Validated. Force N; gauge extension mm; engineering stress Pa; engineering strain 1.',
 '検証できません: ':'Validation refused: ',
 '比較JSONは合計最大2MiBです。':'Comparison JSON must not exceed 2 MiB in total.',
 '複数曲線の静止SVG。荷重–標点伸び mm・N、工学SS 1・Pa。':'Static multi-curve SVG: force–gauge extension mm/N and engineering stress–strain 1/Pa.'
};

// Presentation only. Always derive artifacts from the strict shared service;
// caller-provided curve rows/SVG never become a drawing or a download.
export function createIncrementCurveComparisonUi({anchor,document=globalThis.document,language=()=> 'ja',translate=()=>{},env={}}={}){
 if(!anchor||!document?.createElement)throw TypeError('Increment curve UI requires a host');
 translate(messages);const tr=text=>language()==='en'?(messages[text]??text):text;
 const url=env.URL??globalThis.URL,BlobType=env.Blob??globalThis.Blob;
 const labels=[];const el=(tag,id,text)=>{const node=document.createElement(tag);if(id)node.id=id;if(tag==='a'){node.style.color='#67e8d9';node.style.textDecoration='underline';node.style.textUnderlineOffset='3px';}if(text){labels.push([node,text]);node.textContent=tr(text);}return node;};
 const host=el('details','increment-comparison-panel'),summary=el('summary',null,'複数の段階グラフを比較');
 host.style.minWidth='0';host.setAttribute('data-no-translate','true');
 const note=el('p',null,'独立した線形弾性結果の荷重–標点伸び（mm・N）と工学SS（ひずみ1・応力Pa）の2図です。失敗段階の線はつなぎません。真応力・塑性履歴ではありません。');
 const input=el('textarea','increment-comparison-input');input.rows=7;input.style.width='100%';input.style.maxWidth='100%';input.style.boxSizing='border-box';input.maxLength=INCREMENT_CURVE_COMPARISON_UI_MAX_BYTES;
 const file=el('input','increment-comparison-file');file.type='file';file.multiple=true;file.accept='.json,application/json';file.style.maxWidth='100%';
 const label=(text,control)=>{const node=el('label'),caption=el('span',null,text);node.append(caption,control);return node;};
 const run=el('button','increment-comparison-run','検証して比較グラフを表示');run.type='button';
 const status=el('p','increment-comparison-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');input.setAttribute('aria-describedby',status.id);file.setAttribute('aria-describedby',status.id);
 const preview=el('img','increment-comparison-preview');preview.hidden=true;preview.style.width='100%';preview.style.maxWidth='100%';preview.style.height='auto';
 const downloads=el('div','increment-comparison-downloads');downloads.style.display='flex';downloads.style.flexWrap='wrap';downloads.style.gap='8px';
 const links={};for(const [kind,text]of [['csv','CSVを保存'],['json','JSONを保存'],['svg','SVGを保存']]){const link=el('a','increment-comparison-'+kind,text);link.hidden=true;link.download='increment-comparison.'+kind;links[kind]=link;downloads.append(link);}
 const instructions=el('a',null,'比較グラフの使い方');instructions.target='_blank';instructions.rel='noopener';
 const sample=el('a','increment-comparison-sample','参照Aを保存');sample.href='./examples/increment-comparison-a.json';sample.download='increment-comparison-a.json';const sampleB=el('a','increment-comparison-sample-b','参照Bを保存');sampleB.href='./examples/increment-comparison-b.json';sampleB.download='increment-comparison-b.json';
 const samples=el('div');samples.style.display='flex';samples.style.flexWrap='wrap';samples.style.gap='8px';samples.append(sample,sampleB);
 host.append(summary,note,el('p',null,'色と凡例で曲線を区別します。材料・形状・標点が異なる場合も各曲線の識別を保持し、別の状態履歴へ結合しません。'),samples,el('p',null,'実solverの合成Tet4参照です。参照AとBを保存し、ファイル欄で2件を同時選択して検証してください。実測や塑性履歴ではありません。'),label('bundlesに2〜4件を含む比較JSON（合計最大2MiB）',input),label('段階bundle JSONファイル（2〜4件を同時選択）',file),run,el('p',null,'入力から再計算して検証します。自己申告のcurveや画像は受け付けません。現在の入力・ケース・解析結果は変更しません。'),instructions,status,preview,downloads);anchor.after(host);
 let epoch=0,urls=[],message='未検証です。検証後に保存できます。',errorDetail='',counts=null;
 const refresh=()=>{for(const [node,text]of labels)node.textContent=tr(text);status.textContent=tr(message)+errorDetail+(counts?(language()==='en'?` Curves: ${counts.total}; failed gaps: ${counts.failed}.`:` 曲線: ${counts.total}、失敗による空白: ${counts.failed}。`):'');preview.alt=tr('複数曲線の静止SVG。荷重–標点伸び mm・N、工学SS 1・Pa。');instructions.href='https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/main/docs/'+(language()==='en'?'en/':'')+'increment-comparison-ui.md';};
 const clear=()=>{epoch++;for(const value of urls)url.revokeObjectURL(value);urls=[];counts=null;for(const link of Object.values(links)){link.hidden=true;link.removeAttribute('href');}preview.hidden=true;preview.removeAttribute('src');run.disabled=false;for(const control of [input,file]){control.removeAttribute('aria-invalid');control.removeAttribute('aria-errormessage');}errorDetail='';};
 const invalidate=()=>{clear();message='入力が変更されました。再検証してください。';refresh();};
 const bounded=text=>{if(typeof text!=='string'||text.length>INCREMENT_CURVE_COMPARISON_UI_MAX_BYTES||new TextEncoder().encode(text).length>INCREMENT_CURVE_COMPARISON_UI_MAX_BYTES)throw Error(tr('比較JSONは合計最大2MiBです。'));return text;};
 const fail=(error,control)=>{message='検証できません: ';errorDetail=String(error?.message??error).slice(0,1000);control.setAttribute('aria-invalid','true');control.setAttribute('aria-errormessage',status.id);refresh();control.focus?.();};
 async function validate(){clear();const current=epoch;run.disabled=true;message='検証中…';refresh();
  try{
   const artifacts=await createIncrementCurveComparison(JSON.parse(bounded(input.value)));
   if(current!==epoch)return null;
   const types={csv:'text/csv;charset=utf-8',json:'application/json',svg:'image/svg+xml'};
   for(const kind of ['csv','json','svg']){const href=url.createObjectURL(new BlobType([artifacts[kind]],{type:types[kind]}));urls.push(href);links[kind].href=href;links[kind].hidden=false;}
   preview.src=links.svg.href;preview.hidden=false;counts={total:artifacts.comparison.curves.length,failed:artifacts.comparison.curves.reduce((sum,curve)=>sum+curve.steps.filter(step=>step.status==='failed').length,0)};message='検証済み。力 N、標点伸び mm、工学応力 Pa、工学ひずみ 1。';refresh();return artifacts.comparison;
  }catch(error){if(current===epoch){clear();fail(error,input);}return null;}finally{if(current===epoch)run.disabled=false;}
 }
 run.onclick=()=>validate();input.oninput=invalidate;
 file.onchange=async()=>{
  clear();input.value='';const current=epoch;run.disabled=true;message='入力が変更されました。再検証してください。';refresh();
  try{
   const selected=Array.from(file.files??[]);if(!selected.length)return;
   if(selected.length<2||selected.length>4)throw Error(tr('2〜4件のbundle JSONファイルを同時に選択してください。'));
   let total=0;for(const entry of selected){if(!Number.isSafeInteger(entry.size)||entry.size<0)throw Error(tr('比較JSONは合計最大2MiBです。'));total+=entry.size;}
   if(total>INCREMENT_CURVE_COMPARISON_UI_MAX_BYTES)throw Error(tr('比較JSONは合計最大2MiBです。'));
   const bundles=[];let actualBytes=0;
   for(const entry of selected){const text=bounded(await entry.text());if(current!==epoch)return;actualBytes+=new TextEncoder().encode(text).length;if(actualBytes>INCREMENT_CURVE_COMPARISON_UI_MAX_BYTES)throw Error(tr('比較JSONは合計最大2MiBです。'));bundles.push(JSON.parse(text));}
   const text=bounded(JSON.stringify({bundles}));if(current!==epoch)return;input.value=text;
  }catch(error){if(current===epoch)fail(error,file);}finally{if(current===epoch)run.disabled=false;}
 };
 document.addEventListener?.('studio-language',refresh);refresh();
 return {host,validate,clear:invalidate,destroy(){clear();document.removeEventListener?.('studio-language',refresh);host.remove?.();}};
}
