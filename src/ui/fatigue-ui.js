// Fatigue UI: material form read/write and the fatigue result summary panel.
// Every dependency is injected; this module imports nothing.
export function createFatigueUi({$,document:doc=globalThis.document,getMaterialProperties,getLanguage}){
 function renderFatigueMaterial(){
  const f=getMaterialProperties().fatigueData;$('fatigue-enabled').checked=!!f;$('fatigue-curve').value=f?JSON.stringify(f.snCurve,null,2):'';$('fatigue-ultimate').value=f?f.ultimateStrengthPa/1e6:400;$('fatigue-yield').value=f?f.yieldStressPa/1e6:250;$('fatigue-source').value=f?.source||'';$('fatigue-test-conditions').value=f?.testConditions||'';
 }
 function readFatigueMaterial(){return {model:'stress-life',stressRatio:-1,snCurve:JSON.parse($('fatigue-curve').value),ultimateStrengthPa:Number($('fatigue-ultimate').value)*1e6,yieldStressPa:Number($('fatigue-yield').value)*1e6,source:$('fatigue-source').value,testConditions:$('fatigue-test-conditions').value};}
 function renderFatigueResult(f){
  const language=getLanguage();
  const root=$('fatigue-summary');root.replaceChildren();if(!f)return;$('fatigue-min-factor').value=f.minLoadFactor;$('fatigue-max-factor').value=f.maxLoadFactor;$('fatigue-cycles').value=f.appliedCycles;$('fatigue-correction').value=f.meanStressCorrection;
  const text=doc.createElement('p');text.textContent=(language==='en'?'Shortest fatigue life: ':'最短疲労寿命: ')+(f.minLifeCycles===null?(language==='en'?'Zero amplitude (life undefined)':'振幅0（寿命未定義）'):f.minLifeCycles.toPrecision(6)+' cycles')+' / '+(language==='en'?'Maximum damage: ':'最大損傷: ')+f.maxDamage.toPrecision(6)+' / '+(language==='en'?'Maximum stress amplitude: ':'最大応力振幅: ')+(Math.max(...f.stressAmplitudePa)/1e6).toPrecision(6)+' MPa';root.append(text);
  const settings=doc.createElement('p');settings.textContent=(language==='en'?'Load factors: ':'荷重倍率: ')+f.minLoadFactor+' → '+f.maxLoadFactor+' / '+f.appliedCycles+' cycles / '+(language==='en'?'Mean stress correction: ':'平均応力補正: ')+f.meanStressCorrection+' / '+(language==='en'?'Maximum corrected amplitude: ':'最大補正振幅: ')+(Math.max(...f.correctedAmplitudePa)/1e6).toPrecision(6)+' MPa';root.append(settings);
  const provenance=doc.createElement('p');provenance.textContent=(language==='en'?'S-N source: ':'S-N出典: ')+f.fatigueData.source+' / '+(language==='en'?'Test conditions: ':'試験条件: ')+f.fatigueData.testConditions;root.append(provenance);
  const note=doc.createElement('p');note.textContent=language==='en'?'Constant-amplitude stress-life estimate using the registered R = −1 data. No fatigue crack or fracture simulation.':'登録したR=−1のS-Nデータによる一定振幅の評価です。疲労き裂や破壊のシミュレーションではありません。';root.append(note);
 }
 return Object.freeze({renderFatigueMaterial,readFatigueMaterial,renderFatigueResult});
}
