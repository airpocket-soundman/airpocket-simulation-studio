// Saved-case list UI: list rendering, save/export/import/text wiring and the
// window.caseApi facade. Every dependency is injected; this module imports nothing.
const KIND_LABELS={elastic:'構造',thermal:'熱',acoustic:'音響',acousticTransient:'過渡音響',modal:'固有振動',channelFlow:'層流流路',stokes:'Stokes流'};
const METRIC_LABELS={maxSpeedMs:'最大流速',outletFlowM3s:'出口流量',maxDisplacementMm:'最大変位',maxVonMisesPa:'最大von Mises',minTemperature:'最低温度',maxTemperature:'最高温度',minPressurePa:'最小圧力',maxSplDb:'最大SPL',lowestFrequencyHz:'最低固有振動数',highestFrequencyHz:'最高固有振動数',receiverPeakPa:'受音点ピーク',receiverRmsPa:'記録全体RMS'};
export function createCaseListUi({$,document:doc=globalThis.document,store,status,viewCase,restoreCaseInput,getLastAnalysis,env={}}){
 const URLApi=env.URL||globalThis.URL,BlobApi=env.Blob||globalThis.Blob,timer=env.setTimeout||globalThis.setTimeout;
 function fillSelect(select,rows,kind){select.replaceChildren();for(const [i,c] of rows.entries())if(c.kind===kind){const option=doc.createElement('option');option.value=i;option.textContent=c.name;select.append(option);}}
 function renderCases(){
  const rows=store.compare();
  fillSelect($('vibration-case'),rows,'modal');fillSelect($('thermal-case'),rows,'thermal');
  const root=$('case-list');root.replaceChildren();
  // With a store that has at()/inspect() the cases are not cloned here; a case is read when its restore button is pressed, and only
  // if it is still the same immutable record that was rendered. Other stores keep the rendered snapshot.
  const lazy=typeof store.at==='function'&&typeof store.inspect==='function',legacy=lazy?null:store.list(),inspected=lazy?store.inspect().cases:null;
  const names=lazy?store.names():legacy.map(c=>c.name);
  const restoreAt=index=>{if(!lazy)return legacy[index];const now=store.inspect().cases[index];if(!now||now.token!==inspected[index].token)throw Error('Unknown case');return store.at(index);};
  for(const [index,name] of names.entries()){
   const row=rows[index],item=doc.createElement('article'),title=doc.createElement('strong');title.textContent=name;item.append(title);
   const summary=doc.createElement('p');
   summary.textContent=(KIND_LABELS[row.kind]||row.kind)+' · '+row.metrics.map(m=>(m.key==='maxPressurePa'?(row.kind==='stokes'?'最大圧力':'最大音圧'):METRIC_LABELS[m.key]||m.key)+': '+m.value.toPrecision(5)+' '+m.unit).join(' / ');
   item.append(summary);
   for(const [label,action] of [['保存結果を3D表示',()=>viewCase(index)],['入力を複製して復元',()=>restoreCaseInput(restoreAt(index))],['削除',()=>{store.remove(index);renderCases();}]]){
    const b=doc.createElement('button');b.textContent=label;b.onclick=()=>{try{action();}catch(e){status(e.message);}};item.append(b);
   }
   root.append(item);
  }
 }
 const caseApi=Object.freeze({...store,view:viewCase,add(name,output){const result=store.add(name,output);renderCases();return result;},import(value){store.import(value);renderCases();},remove(index){store.remove(index);renderCases();},...(typeof store.rename==='function'?{rename(index,name){store.rename(index,name);renderCases();}}:{}),...(typeof store.adopt==='function'?{adopt(other){store.adopt(other);renderCases();}}:{})});
 function install(){
  $('case-add').onclick=()=>{try{if(!getLastAnalysis()?.result)throw Error('Run an analysis first');caseApi.add($('case-name').value,getLastAnalysis());}catch(e){status(e.message);}};
  $('case-export').onclick=()=>{const url=URLApi.createObjectURL(new BlobApi([JSON.stringify(store.export())],{type:'application/json'}));const a=doc.createElement('a');a.href=url;a.download='simulation-cases.json';a.click();timer(()=>URLApi.revokeObjectURL(url),1000);};
  $('case-import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000000)throw Error('Case archive exceeds 100 MB');caseApi.import(JSON.parse(await file.text()));}catch(error){status(error.message);}finally{e.target.value='';}};
  $('case-text-show').onclick=()=>{$('case-text').value=JSON.stringify(store.export());};
 }
 install();
 return Object.freeze({renderCases,caseApi});
}
