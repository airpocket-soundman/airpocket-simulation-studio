const T={
 '比較設定をこのブラウザに自動保存する':'Save comparison settings automatically in this browser',
 '保存した比較設定を復元':'Restore saved comparison settings','保存した比較設定を削除':'Delete saved comparison settings',
 '比較を表示したときの設定を1件、このブラウザだけに保存します。ケースや動画は保存しません。':'Keep one preset in this browser after showing a comparison. Cases and videos are not saved.',
 '保存した比較設定があります。ケースを読み込んでから復元できます。':'Saved comparison settings are available. Load the cases, then restore them.',
 '自動保存は無効です。手動の設定ファイルは引き続き使えます。':'Automatic saving is off. Manual settings files remain available.',
 '比較を表示すると設定を自動保存します。':'Settings will be saved after showing a comparison.',
 'ブラウザ保存または復元に失敗しました。現在の表示は変更せず、手動の設定ファイルは引き続き使えます。':'Browser storage or restoration failed. The current view is unchanged; manual settings files remain available.'
};
export function installComparisonSettingsPersistenceUi({document:doc=globalThis.document,anchor,persistence,language=()=> 'ja',translate=()=>{}}){
 translate(T);const tr=s=>language()==='en'?T[s]??s:s;
 const host=doc.createElement('div'),label=doc.createElement('label'),enabled=doc.createElement('input'),restore=doc.createElement('button'),remove=doc.createElement('button'),note=doc.createElement('p'),status=doc.createElement('p');
 host.id='compare-persistence';enabled.id='compare-persistence-enabled';enabled.type='checkbox';restore.id='compare-persistence-restore';remove.id='compare-persistence-remove';status.id='compare-persistence-status';status.setAttribute('role','status');
 label.textContent='比較設定をこのブラウザに自動保存する';label.append(enabled);restore.textContent='保存した比較設定を復元';remove.textContent='保存した比較設定を削除';note.textContent='比較を表示したときの設定を1件、このブラウザだけに保存します。ケースや動画は保存しません。';host.append(label,restore,remove,note,status);anchor.append(host);
 let busy=false;
 function refresh(){const state=persistence.getState();enabled.checked=state.enabled;enabled.disabled=busy;restore.disabled=busy||!state.hasCandidate;remove.disabled=busy||!state.hasCandidate&&!state.enabled&&!state.error;status.textContent=tr(state.error?'ブラウザ保存または復元に失敗しました。現在の表示は変更せず、手動の設定ファイルは引き続き使えます。':state.hasCandidate?'保存した比較設定があります。ケースを読み込んでから復元できます。':state.enabled?'比較を表示すると設定を自動保存します。':'自動保存は無効です。手動の設定ファイルは引き続き使えます。');}
 async function run(work){busy=true;refresh();try{await work();}finally{busy=false;refresh();}}
 enabled.onchange=()=>{const checked=enabled.checked;return run(()=>persistence.setEnabled(checked));};restore.onclick=()=>run(()=>persistence.restore());remove.onclick=()=>run(()=>persistence.remove());
 doc.addEventListener?.('studio-language',refresh);refresh();return {refresh};
}
