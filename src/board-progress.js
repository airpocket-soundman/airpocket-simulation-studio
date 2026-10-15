import {chartModel,historyNotices,historyMatchesProgress,MAX_HISTORY_IDS} from './progress-history.js';
import {estimateProductCompletion,STATUS_CREDIT,UNTRACKED_CREDIT,PENDING_GATE_HIGH_FACTOR,PRODUCT_RUBRIC} from './product-estimate.js';
import {statusNames} from './progress.js';
import {language} from './i18n.js';

const SVG='http://www.w3.org/2000/svg';
const labels={queued:['待機','Queued'],building:['実装中','Building'],checking:['検証中','Checking'],fixing:['修正中','Fixing'],ready:['検証済み・未公開','Ready'],released:['公開済み','Released']};
// Colour is never the only cue: each status also has its own dash pattern and marker shape.
const looks={queued:{color:'#b6b2a4',dash:'2 4',shape:'circle'},building:{color:'#6ea2e8',dash:'8 4',shape:'square'},checking:{color:'#c08be0',dash:'',shape:'triangle'},fixing:{color:'#f0954d',dash:'10 3 2 3',shape:'diamond'},ready:{color:'#5fcf9f',dash:'1 5',shape:'plus'},released:{color:'#f2d36b',dash:'14 2',shape:'cross'}};
const t=(ja,en)=>language==='en'?en:ja;
const name=status=>labels[status][language==='en'?1:0];
const ui={hidden:new Set(),selected:null,key:null};
let resizeObserver=null;
const h=(tag,props={},...children)=>{const e=document.createElement(tag);for(const [k,v]of Object.entries(props)){if(v===undefined||v===false)continue;if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k.startsWith('on'))e[k]=v;else e.setAttribute(k,v===true?'':v);}e.append(...children.flat().filter(c=>c!==undefined&&c!==null&&c!==false));return e;};
const s=(tag,props={},...children)=>{const e=document.createElementNS(SVG,tag);for(const [k,v]of Object.entries(props))if(v!==undefined&&v!=='')e.setAttribute(k,v);e.append(...children.flat().filter(Boolean));return e;};
const format=(iso,style='medium')=>new Intl.DateTimeFormat(language==='en'?'en-GB':'ja-JP',{timeZone:'Asia/Tokyo',dateStyle:style,...(style==='medium'?{timeStyle:'short'}:{})}).format(new Date(iso));
const shapePath=(shape,x,y)=>({circle:`M${x-3} ${y}a3 3 0 1 0 6 0a3 3 0 1 0-6 0`,square:`M${x-3} ${y-3}h6v6h-6z`,triangle:`M${x} ${y-3.5}l3.5 6.5h-7z`,diamond:`M${x} ${y-4}l4 4-4 4-4-4z`,plus:`M${x-3.5} ${y}h7M${x} ${y-3.5}v7`,cross:`M${x-3} ${y-3}l6 6M${x+3} ${y-3}l-6 6`}[shape]);
const mark=(status,x,y,extra={})=>s('path',{d:shapePath(looks[status].shape,x,y),fill:looks[status].color,stroke:looks[status].color,'stroke-width':1.6,...extra});
function swatch(status){return s('svg',{width:30,height:14,viewBox:'0 0 30 14','aria-hidden':'true',focusable:'false'},s('path',{d:'M1 7H29',stroke:looks[status].color,'stroke-width':2,'stroke-dasharray':looks[status].dash,fill:'none'}),mark(status,15,7));}

function historyUnavailable(state,verified){
 if(!verified)return t('配信版の進捗を照合するまで、履歴は表示しません（同梱の初期記録には履歴がありません）。','History is shown only after the published progress is verified; the bundled initial record carries no history.');
 if(state.status==='loading')return t('履歴を照合中…','Verifying history…');
 const reason={PUBLISHED_HISTORY_ABSENT:t('この公開版には履歴の成果物がありません（履歴導入前の版）。','This published build has no history artifact (built before history existed).'),PUBLISHED_HISTORY_MISMATCH:t('履歴が検証済みの公開候補と一致しないため表示しません。','The history does not match the verified published candidate, so it is not shown.')}[state.code];
 return reason||t('履歴を検証できなかったため表示しません。','The history could not be verified, so it is not shown.')+' ('+(state.code||'unknown')+')';
}
function noticeText(code,history){
 const c=history.completeness;
 return {
  shallow:t('浅いclone（shallow）から生成したため、取得できなかった古い履歴があります。表示は取得できた範囲だけです。','Generated from a shallow clone: older history was unavailable and only what was fetched is shown.'),
  truncated:t(`履歴が上限${c.maxPoints}件を超えたため、古い記録点を省略しています。最古の点の差分は不明です。`,`History exceeded the ${c.maxPoints}-commit limit; older points are omitted and the oldest shown point has no known diff.`),
  'single-point':t('記録点が1つだけのため推移は描けません。表の値だけを示します。','Only one recorded point exists, so no trend can be drawn; the table shows its values.'),
  skipped:t(`${c.skippedCount}件のコミットはprogress.jsonを読めません。未知区間の前値補完を避けるため、連続線を描かず確認できた点だけを表示します。`,`${c.skippedCount} commit(s) had unreadable progress.json. Only known points are shown, with no connecting lines or forward-filled unknown intervals.`),
  regressions:t(`コミット時刻が${c.timestampRegressions}回逆転しているため、時刻順に描画しています。`,`Commit timestamps go backwards ${c.timestampRegressions} time(s); points are drawn in time order.`)
 }[code];
}
function pointText(point){return `${format(point.committedAt)} · ${point.revision.slice(0,7)} · `+statusNames.map(status=>name(status)+' '+point.counts[status]).join(' / ')+' · '+t('合計 ','total ')+point.total;}

function historySection(state,{progress,repo,verified}){
 const section=h('section',{class:'hist','aria-labelledby':'hist-title'},h('h3',{id:'hist-title',text:t('作業数の推移（Git履歴）','Task counts over time (Git history)')}));
 if(state.status!=='verified'){section.append(h('p',{class:'notice',role:'status',text:historyUnavailable(state,verified)}));return section;}
 const history=state.history,pts=history.points,matches=historyMatchesProgress(history,progress);
 const key=history.head.revision+':'+history.head.progressSha256;
 if(ui.key!==key){ui.key=key;ui.selected=null;}
 const chartBox=h('div',{class:'hist-chart'}),legend=h('div',{class:'hist-legend',role:'group','aria-label':t('表示するステータス','Statuses shown')}),details=h('div',{class:'hist-details','aria-live':'polite'}),slider=h('input',{type:'range',min:0,max:pts.length-1,step:1,id:'hist-slider'}),tableBody=h('tbody');
 let model=chartModel(history,{hidden:[...ui.hidden]});
 const selectedPosition=()=>ui.selected===null?model.order.length-1:ui.selected;
 const select=position=>{ui.selected=Math.max(0,Math.min(model.order.length-1,position));draw();};
 function drawLegend(){
  const last=pts[model.order.at(-1)];
  legend.replaceChildren(...statusNames.map(status=>h('button',{type:'button',class:'hist-toggle','aria-pressed':String(!ui.hidden.has(status)),onclick:()=>{if(!ui.hidden.has(status)&&ui.hidden.size>=statusNames.length-1)return;ui.hidden.has(status)?ui.hidden.delete(status):ui.hidden.add(status);draw();}},swatch(status),h('span',{text:name(status)}),h('b',{text:String(last.counts[status])}))));
 }
 function drawChart(){
  const width=Math.max(300,Math.min(960,Math.floor(chartBox.clientWidth||720))),height=width<520?260:320,cursorPosition=selectedPosition();
  model=chartModel(history,{width,height,hidden:[...ui.hidden]});
  const {plot}=model,pickIndex=model.order[cursorPosition],first=model.series[0].points;
  const svg=s('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-labelledby':'hist-svg-title hist-svg-desc',class:'hist-svg'},
   s('title',{id:'hist-svg-title'}),s('desc',{id:'hist-svg-desc'}));
  svg.querySelector('title').textContent=t('ステータス別の作業数の推移','Task count per status over commits');
  svg.querySelector('desc').textContent=t(`${pts.length}個のコミット記録点。${format(pts[model.order[0]].committedAt)}から${format(pts[model.order.at(-1)].committedAt)}まで。各点はその時点のprogress.jsonの実測値で、点の間は直前の値を保持した階段線です。同じデータの表が下にあります。`,`${pts.length} recorded commit points from ${format(pts[model.order[0]].committedAt)} to ${format(pts[model.order.at(-1)].committedAt)}. Each point is the measured progress.json at that commit; lines hold the previous value between points. The same data is in the table below.`);
  if(!model.connected)svg.querySelector('desc').textContent=t('欠落した履歴があるため連続線を描かず、確認できたコミットの点だけを表示。同じデータの表が下にあります。','Missing history: only known commit points are shown, without connecting lines. The same data is in the table below.');
  for(const tick of model.yTicks){svg.append(s('line',{x1:plot.left,x2:width-plot.right,y1:tick.y,y2:tick.y,stroke:'#48463d','stroke-width':1}),s('text',{x:plot.left-6,y:tick.y+4,'text-anchor':'end',fill:'#b6b2a4','font-size':11}));svg.lastChild.textContent=String(tick.value);}
  for(const tick of model.xTicks){const label=s('text',{x:tick.x,y:height-plot.bottom+18,'text-anchor':tick.x<plot.left+30?'start':tick.x>width-plot.right-30?'end':'middle',fill:'#b6b2a4','font-size':11});label.textContent=format(tick.time,'short');svg.append(label);}
  for(const m of model.markers){const line=s('path',{d:`M${m.x} ${plot.top}V${height-plot.bottom}`,stroke:'#fbe39a','stroke-width':1,'stroke-dasharray':'3 3',opacity:.55}),tip=s('title');tip.textContent=t(`タスク追加 ${m.addedCount} / 削除 ${m.removedCount}`,`Tasks added ${m.addedCount} / removed ${m.removedCount}`);line.append(tip);svg.append(line);}
  for(const series of model.series)if(series.visible)svg.append(s('path',{d:series.path,fill:'none',stroke:looks[series.status].color,'stroke-width':2,'stroke-dasharray':looks[series.status].dash,'stroke-linejoin':'round'}));
  for(const series of model.series)if(series.visible)series.points.forEach((p,position)=>{if(!model.connected||pts.length<=120||position===cursorPosition)svg.append(mark(series.status,p.x,p.y,position===cursorPosition?{'stroke-width':2.4}:{opacity:.9}));});
  if(first.length)svg.append(s('path',{d:`M${first[cursorPosition].x} ${plot.top}V${height-plot.bottom}`,stroke:'#fff','stroke-width':1.5,opacity:.8}));
  const hit=s('rect',{x:plot.left,y:plot.top,width:plot.w,height:plot.h,fill:'transparent',style:'touch-action:pan-y;cursor:crosshair'});
  const nearest=event=>{const rect=svg.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*width;let best=0;first.forEach((p,k)=>{if(Math.abs(p.x-x)<Math.abs(first[best].x-x))best=k;});select(best);};
  hit.addEventListener('pointerdown',nearest);hit.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'&&event.buttons===1)nearest(event);});
  svg.append(hit);chartBox.replaceChildren(svg);
  return pickIndex;
 }
 function drawDetails(index){
  const p=pts[index],added=p.addedCount,diff=added===null?h('p',{text:history.completeness.truncated||history.completeness.shallow?t('これより古い記録点がなく、差分は不明です。','No older recorded point, so the diff is unknown.'):t('最初の記録点（この時点でprogress.jsonが作られた）。差分はありません。','First recorded point (progress.json created here); no diff.')}):h('p',{text:t(`直前の記録点との差: 追加 ${p.addedCount}件${p.added.length?'（'+p.added.join('、')+(p.addedCount>MAX_HISTORY_IDS?' …':'')+'）':''} / 削除 ${p.removedCount}件${p.removed.length?'（'+p.removed.join('、')+(p.removedCount>MAX_HISTORY_IDS?' …':'')+'）':''}。IDの付け替えは追加+削除に見えます。`,`Versus previous recorded point: ${p.addedCount} added${p.added.length?' ('+p.added.join(', ')+(p.addedCount>MAX_HISTORY_IDS?' …':'')+')':''} / ${p.removedCount} removed${p.removed.length?' ('+p.removed.join(', ')+(p.removedCount>MAX_HISTORY_IDS?' …':'')+')':''}. A renamed ID appears as remove + add.`)});
  const commit=h('a',{href:repo+'/commit/'+p.revision,target:'_blank',rel:'noopener',text:p.revision.slice(0,12)+' ↗'});
  details.replaceChildren(h('h4',{text:format(p.committedAt)+' JST'}),h('p',{},t('コミット ','Commit '),commit),h('ul',{class:'hist-counts'},...statusNames.map(status=>h('li',{},swatch(status),h('span',{text:name(status)+': '}),h('b',{text:String(p.counts[status])})))),h('p',{text:t('作業合計 ','Total tasks ')+p.total}),diff);
  slider.setAttribute('aria-valuetext',pointText(p));
 }
 // Rows are built once; selecting a commit only moves the highlight (the table can hold 1000 rows).
 const ids=(count,list)=>count===null?'—':count+(list.length?' ('+list.join(', ')+(count>MAX_HISTORY_IDS?' …':'')+')':'');
 const rowOf=new Map(model.order.map(i=>{const p=pts[i];return [i,h('tr',{},h('th',{scope:'row',text:format(p.committedAt)}),h('td',{text:p.revision.slice(0,7)}),...statusNames.map(status=>h('td',{class:'num',text:String(p.counts[status])})),h('td',{class:'num',text:String(p.total)}),h('td',{text:ids(p.addedCount,p.added)}),h('td',{text:ids(p.removedCount,p.removed)}))];}));
 tableBody.append(...rowOf.values());
 let currentRow=null;
 function markRow(index){currentRow?.removeAttribute('aria-current');currentRow?.classList.remove('selected');currentRow=rowOf.get(index);currentRow.setAttribute('aria-current','true');currentRow.classList.add('selected');}
 function draw(){drawLegend();const index=drawChart();slider.value=String(selectedPosition());drawDetails(index);markRow(index);}
 slider.setAttribute('aria-label',t('コミットを選んで詳細を表示（矢印キー）','Select a commit to show details (arrow keys)'));
 slider.oninput=()=>select(Number(slider.value));
 const notices=historyNotices(history).map(code=>h('li',{text:noticeText(code,history)}));
 if(matches===false)notices.push(h('li',{text:t('最新の記録点が表示中の進捗の件数と一致しません。','The newest recorded point differs from the progress currently shown.')}));
 const table=h('table',{class:'hist-table'},h('caption',{text:t('コミットごとのステータス別作業数（時刻順）','Task counts per status per commit (time order)')}),h('thead',{},h('tr',{},h('th',{scope:'col',text:t('コミット日時 (JST)','Commit time (JST)')}),h('th',{scope:'col',text:t('版','Rev')}),...statusNames.map(status=>h('th',{scope:'col',class:'num',text:name(status)})),h('th',{scope:'col',class:'num',text:t('合計','Total')}),h('th',{scope:'col',text:t('追加','Added')}),h('th',{scope:'col',text:t('削除','Removed')}))),tableBody);
 section.append(
  h('p',{class:'sub',text:t('実際のGit履歴にある、src/progress.jsonを変更したコミットごとの実測値です。欠落がない場合のみ直前の値を保持する階段線を描き、欠落がある場合は確認できた点だけを示します。縦の点線はタスクの追加・削除があった記録点です。','Measured values for each commit that changed src/progress.json. With no missing records, step lines hold the previous value between commits. If any records are missing, only known points are shown. Dotted vertical lines mark points where tasks were added or removed.')}),
  notices.length?h('ul',{class:'hist-notices',role:'status'},...notices):'',
  legend,chartBox,h('label',{class:'hist-slider-label',for:'hist-slider',text:t('コミットを選ぶ','Select commit')}),slider,details,
  h('details',{class:'hist-table-wrap',open:pts.length<2},h('summary',{text:t(`表で見る（${pts.length}記録点）`,`View as a table (${pts.length} points)`)}),h('div',{class:'hist-scroll',role:'region',tabindex:'0','aria-label':t('履歴の表','History table')},table)));
 // Drawn after attach so the chart can measure its container.
 queueMicrotask(()=>{if(!chartBox.isConnected)return;draw();if(typeof ResizeObserver==='function'){let width=chartBox.clientWidth;resizeObserver=new ResizeObserver(()=>{if(Math.abs(chartBox.clientWidth-width)>8){width=chartBox.clientWidth;draw();}});resizeObserver.observe(chartBox);}});
 return section;
}

const pct=value=>(Math.round(value*1000)/10).toFixed(1)+'%';
function estimateSection({tasks,milestone,verified,revision}){
 const result=estimateProductCompletion({tasks,publicationMilestone:milestone,candidateRevision:verified?revision:undefined}),{display,raw}=result.estimate,obs=result.observed;
 const section=h('section',{class:'est','aria-labelledby':'est-title'},h('h3',{id:'est-title',text:t('製品全体の達成度（推定）','Progress toward the full product (estimate)')}));
 const source=verified?t(`照合済みの配信候補 ${revision.slice(0,12)} の進捗から計算`,`Computed from verified published candidate ${revision.slice(0,12)}`):t('同梱の初期記録から計算（配信版は未照合）','Computed from the bundled initial record (published version not verified)');
 section.append(
  h('div',{class:'est-head'},h('p',{class:'est-value',text:t(`推定 約${display.central}%`,`Estimate ≈ ${display.central}%`)}),h('p',{class:'est-range',text:t(`目安の幅 ${display.low}–${display.high}%`,`Range ${display.low}–${display.high}%`)})),
  h('div',{class:'est-bar',role:'img','aria-label':t(`推定${display.central}%、幅${display.low}から${display.high}%`,`Estimate ${display.central}%, range ${display.low} to ${display.high}%`)},h('span',{class:'est-span',style:`left:${raw.low}%;width:${Math.max(0,raw.high-raw.low)}%`}),h('span',{class:'est-point',style:`left:${Math.min(raw.central,100)}%`})),
  h('p',{class:'sub',text:t('これは固定の採点表による推定値であり、測定値でも完了日の予測でもありません。公開済み作業の割合は製品の達成度ではありません。','This is an estimate from a fixed rubric, not a measurement or a completion-date forecast. The share of released tasks is not product completion.')}),
  result.scope.complete?'':h('p',{class:'notice',text:t(`範囲が未完了のため100%は表示しません（未追跡の項目 ${result.scope.untrackedElements}、未公開のP0〜P6 ${result.scope.openPlanTasks.length}、未完了の項目 ${result.scope.openItems}、公開マイルストーン${result.scope.milestoneComplete?'完了':'未完了'}）。`,`100% is not shown while scope is incomplete (${result.scope.untrackedElements} untracked elements, ${result.scope.openPlanTasks.length} of P0–P6 not released, ${result.scope.openItems} open items, publication milestone ${result.scope.milestoneComplete?'complete':'pending'}).`)}),
  h('p',{class:'sub',text:source}),
  h('div',{class:'est-observed'},h('h4',{text:t('観測値（進捗JSONの作業数。推定とは別）','Observed (task counts in progress JSON; separate from the estimate)')}),h('ul',{class:'hist-counts'},...statusNames.map(status=>h('li',{},swatch(status),h('span',{text:name(status)+': '}),h('b',{text:String(obs.counts[status])})))),h('p',{text:t(`作業 ${obs.total}件のうち公開済み ${obs.counts.released}件（${obs.releasedShare===null?'—':(obs.releasedShare*100).toFixed(1)+'%'}）。作業の追加・細分化で分母は変わります。`,`${obs.counts.released} of ${obs.total} tasks are released (${obs.releasedShare===null?'—':(obs.releasedShare*100).toFixed(1)+'%'}). The denominator changes as tasks are added or split.`)})));
 const rubric=h('details',{class:'est-rubric'},h('summary',{text:t('採点表・根拠・未確定事項','Rubric, basis and unknowns')}));
 rubric.append(h('p',{text:t('各項目の達成度 = 紐づく作業の状態点の（平均+最小）÷2。重みは docs/roadmap.md の優先順位に基づく固定値で合計100。専用タスクがない項目は未知として0点（楽観側のみ0.2）。マイルストーンのゲートは、表示候補と一致する合格証跡がある時だけ満点。過去候補の成功は継承しません。','Element credit = (mean + minimum) / 2 of its tasks’ status credits. Weights are fixed from the priorities in docs/roadmap.md and sum to 100. An element with no dedicated task is unknown and earns 0 (0.2 only in the optimistic case). A milestone gate scores full only with passing evidence matching the displayed candidate. Historical success is not inherited.')}));
 rubric.append(h('table',{class:'est-table'},h('caption',{text:t('状態点（低 / 中心 / 高）','Status credit (low / central / high)')}),h('thead',{},h('tr',{},h('th',{scope:'col',text:t('状態','Status')}),h('th',{scope:'col',class:'num',text:t('低','Low')}),h('th',{scope:'col',class:'num',text:t('中心','Central')}),h('th',{scope:'col',class:'num',text:t('高','High')}))),h('tbody',{},...statusNames.map(status=>h('tr',{},h('th',{scope:'row',text:name(status)}),...['low','central','high'].map(level=>h('td',{class:'num',text:String(STATUS_CREDIT[level][status])})))),h('tr',{},h('th',{scope:'row',text:t('追跡なし','Untracked')}),...['low','central','high'].map(level=>h('td',{class:'num',text:String(UNTRACKED_CREDIT[level])}))),h('tr',{},h('th',{scope:'row',text:t('未完了ゲート','Pending gate')}),h('td',{class:'num',text:'0'}),h('td',{class:'num',text:'0'}),h('td',{class:'num',text:'×'+PENDING_GATE_HIGH_FACTOR})))));
 rubric.append(h('p',{text:t('公開済みの中心点は0.9で、範囲が完了しreleasedのみで閉じた場合にだけ1になります。追跡なしの要件は、採点表を改訂して受入証跡に対応する作業IDへ紐づける必要があります（重み合計100は維持）。','The central credit for a released task is 0.9; it becomes 1 only when the whole scope is closed. Untracked requirements need a rubric revision linking them to evidence-bearing acceptance tasks, preserving total weight 100.')}));
 for(const criterion of result.criteria){
  const share=criterion.credit.central;
  rubric.append(h('details',{class:'est-criterion'},h('summary',{text:`${criterion.id} · ${language==='en'?criterion.en:criterion.ja} — ${t('重み','weight')} ${criterion.weight} · ${t('寄与','contribution')} ${(criterion.weight*share).toFixed(1)} (${pct(share)}; ${pct(criterion.credit.low)}–${pct(criterion.credit.high)})`}),
   h('p',{class:'sub',text:(language==='en'?criterion.reasonEn:criterion.reasonJa)+' / '+t('根拠文書: ','Basis: ')+criterion.source}),
   h('div',{class:'hist-scroll',role:'region',tabindex:'0','aria-label':criterion.id},h('table',{class:'est-table'},h('thead',{},h('tr',{},h('th',{scope:'col',text:t('要素','Element')}),h('th',{scope:'col',class:'num',text:t('要素重み','Weight')}),h('th',{scope:'col',class:'num',text:t('中心','Central')}),h('th',{scope:'col',text:t('紐づく作業と状態','Tasks and status')}))),h('tbody',{},...criterion.elements.map(el=>h('tr',{},h('th',{scope:'row',text:language==='en'?el.en:el.ja}),h('td',{class:'num',text:el.weight.toFixed(2)}),h('td',{class:'num',text:pct(el.credit.central)}),h('td',{text:el.gate?t('ゲート ','Gate ')+el.gate.id+': '+(el.gate.status??t('不明','unknown'))+' / '+(el.gate.currentEvidence?t('現候補の証跡一致','current candidate matched'):t('現候補では未確認','current candidate unverified'))+(el.tasks.length?' ← '+el.tasks.map(i=>i.id+':'+(i.status??'?')).join(', '):''):el.tasks.length?el.tasks.map(i=>i.id+':'+(i.status??t('欠落','missing'))).join(', '):t('追跡なし（未知）','untracked (unknown)')}))))))));
 }
 rubric.append(h('h4',{text:t(`未確定事項（追跡する作業がない項目 ${result.unknowns.length}件）`,`Unknowns (${result.unknowns.length} elements no task tracks)`)}),h('ul',{},...result.unknowns.map(u=>h('li',{text:`${u.criterion}: ${language==='en'?u.en:u.ja}`}))));
 rubric.append(h('h4',{text:t('限界','Limitations')}),h('ul',{},...[
  t('重みと状態点は文書の優先順位に基づく判断で、統計的な信頼区間ではありません。幅は採点表の楽観/保守の差です。','Weights and credits are judgments from documented priorities, not a statistical interval; the range is the spread between the conservative and optimistic rubric.'),
  t('作業の状態は自己申告で、証跡の再検証はしていません。','Task status is self-reported; evidence is not re-verified here.'),
  t('完了したゲートは、その証跡に記録された候補リビジョンについての判定で、現在のコミットの再確認ではありません。','A complete gate refers to the candidate revision in its evidence, not a recheck of the current commit.'),
  t('数値収束や物理精度の達成度ではなく、完了日・工数も予測しません。','This is not numerical-convergence or physical-accuracy progress, and gives no date or effort forecast.')
 ].map(text=>h('li',{text}))));
 section.append(rubric);
 return section;
}

/** Render the status-history chart and product estimate. `history` is
 * {status:'verified'|'unavailable'|'loading',history?,code?}; only verified
 * published candidates supply history. Estimates use the progress being shown. */
export function renderProgressView(panel,{tasks,milestone,history,verified,revision,progress,repo}){
 resizeObserver?.disconnect();resizeObserver=null;
 panel.classList.add('progress-panel');
 panel.replaceChildren(historySection(history,{progress,repo,verified}),estimateSection({tasks,milestone,verified,revision}));
}
export {PRODUCT_RUBRIC};
