// Status line UI: fixed Japanese labels for known status/engine messages, falling back to the
// injected localizer. Every dependency is injected; this module imports nothing.
export const STATUS_LABELS=Object.freeze({'Material temperature table does not allow extrapolation':'登録した温度表の範囲外です。補外は行いません。','Temperature is outside the registered material validity range':'登録した材料の有効温度範囲外です。','Temperature-dependent elasticity currently requires a uniform temperature':'温度依存の弾性物性には一様温度が必要です。','Rate-dependent structural constitutive models are not supported':'速度依存の構造モデルは未対応です。','Orthotropic structural constitutive models are not supported':'直交異方性の構造モデルは未対応です。','Static structure has zero strain rate, outside the registered test envelope':'静解析のひずみ速度0が登録した試験範囲外です。','Conflicting displacement constraints on a shared node':'共有節点で指定変位が矛盾しています。','Insufficient constraints: rigid motion remains on a disconnected solid (collinear or directional supports)':'拘束不足です。独立した部品の平行移動・回転を止めてください。','Constraint directions are nearly parallel':'拘束方向がほぼ平行です。方向の重複を見直してください。','Calculation cancelled':'計算を中止しました。','Generating volume mesh…':'体積メッシュを生成中…','Transferring boundary regions…':'領域条件を転送中…','Solving linear elasticity…':'構造解析を計算中…','Solving heat conduction…':'熱伝導を計算中…','Solving frequency-domain acoustics…':'音響解析を計算中…'});
// Known messages that need the user's attention; marked 要確認 in the history (UIIMPROVE1 案3).
export const STATUS_WARNINGS=Object.freeze(new Set(Object.keys(STATUS_LABELS).slice(0,9)));
export const STATUS_HISTORY_LIMIT=6;
// The single #status line is kept for compatibility; #diagnostics-list (optional) keeps the
// latest messages newest-first so an overwritten error stays visible. Repeats are collapsed.
export function createStatusUi({$,localizeStatus,labels=STATUS_LABELS,warnings=STATUS_WARNINGS,limit=STATUS_HISTORY_LIMIT,createElement=tag=>document.createElement(tag)}){
 const history=[];
 function render(){
  const list=$('diagnostics-list');if(!list)return;
  list.replaceChildren(...history.map(entry=>{const li=createElement('li');li.className=entry.warning?'warning':'';li.textContent=(entry.warning?'要確認: ':'')+entry.text+(entry.count>1?` (×${entry.count})`:'');return li;}));
  const count=$('diagnostics-count');if(count)count.textContent=String(history.length);
 }
 function status(text){
  const shown=labels[text]||localizeStatus(text);$('status').textContent=shown;
  if(history[0]?.text===shown)history[0].count++;else{history.unshift({text:shown,warning:warnings.has(text),count:1});history.length=Math.min(history.length,limit);}
  render();
 }
 status.history=()=>history.map(entry=>({...entry}));
 return status;
}
