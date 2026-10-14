export function installCaseBundleUi({api,isBusy=()=>false,translate,language=()=> 'ja',status=()=>{}}){
 const root=document.createElement('details');root.id='case-view-bundle';
 root.innerHTML='<summary>ケースとビューを一緒に保存</summary><button id="case-bundle-export">ケースとビューを書き出す</button><label class="file">ケースとビューを開く<input id="case-bundle-import" type="file" accept=".json"></label><p>対応する結果がないビューは保存できません。先に結果をケースへ保存してください。読込後はケースを表示し、保存ビューを適用できます。</p><p id="case-bundle-status" role="status"></p>';
 document.querySelector('#case-import').closest('section').append(root);
 const output=root.querySelector('#case-bundle-export'),input=root.querySelector('#case-bundle-import'),message=root.querySelector('#case-bundle-status');let running=false,lastMessage;
 const say=(ja,en)=>{lastMessage=[ja,en];message.textContent=language()==='en'?en:ja;};
 document.addEventListener('studio-language',()=>{if(lastMessage)say(...lastMessage);});
 async function action(callback){if(running||isBusy()){say('実行中の処理を終了してから操作してください。','Finish the active operation first.');return;}running=true;output.disabled=input.disabled=true;try{await callback();}catch(error){say('ケース・ビューの操作に失敗しました: '+error.message,'Bundle operation failed: '+error.message);status(message.textContent);}finally{running=false;output.disabled=input.disabled=false;}}
 output.onclick=()=>action(async()=>{const {archive}=await api.exportArchive(),url=URL.createObjectURL(new Blob([JSON.stringify(archive)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='simulation-cases-and-views.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('ケースとビューを書き出しました。','Exported cases and views.');});
 input.onchange=()=>{const file=input.files[0];input.value='';if(file)action(async()=>{if(file.size>100000000)throw Error('Bundle exceeds 100000000 bytes');const {archiveRevision}=await api.list(),archive=JSON.parse(await file.text()),result=await api.importArchive({archive,expectedArchiveRevision:archiveRevision});say(result.caseCount+' ケース・'+result.viewCount+' ビューを読み込みました。','Imported '+result.caseCount+' cases and '+result.viewCount+' views.');});};
 translate({'ケースとビューを一緒に保存':'Save cases and views together','ケースとビューを書き出す':'Export cases and views','ケースとビューを開く':'Open cases and views','対応する結果がないビューは保存できません。先に結果をケースへ保存してください。読込後はケースを表示し、保存ビューを適用できます。':'Views require their matching saved results. Save results as cases first. After import, display a case and apply its saved view.'});
 return root;
}
