import {computeSharedRange,formatQuantity,formatSeconds,legendBars,planCompareView} from './view-compare-layout.js';
const labels={'要求時刻':'Requested physical time','最終ステップのみ（共通時刻は適用されません）':'Final step only (shared time does not apply)','保存フレームとのずれ':'Offset from stored frame','時間軸なし':'no time axis','共通色範囲':'Shared colour range','変形倍率':'Deformation scale','物理時刻':'Physical time','共通の物理時刻を入力してください。':'Enter the shared physical time.'};
const defaultOutput={width:1280,height:640,labelHeight:96,legendHeight:100};
/** Canvas composition with injected case inspection/rendering; no document or viewer globals. */
export function createComparisonRenderer({inspectCase,renderCase,createCanvas,colorAt=()=> '#888',language=()=> 'ja',translate}){
 const tr=translate??(text=>language()==='en'?(labels[text]??text):text);
 return {render({cases,field,deformScale,camera,timeSeconds,toleranceSeconds,output=defaultOutput,colorRange}){
  if(!Array.isArray(cases)||cases.length!==2)throw Error('Comparison requires exactly two cases');
  const infos=cases.map(c=>inspectCase(c.source,field));
  if(infos.some(info=>!info.fields?.includes(field)))throw Error('Field is unavailable for one or more comparison cases');
  if(infos.some(info=>info.frameTimes)&&!Number.isFinite(timeSeconds))throw Error(tr('共通の物理時刻を入力してください。'));
  const descriptors=cases.map((c,k)=>({caseId:c.caseId,label:c.label,conditions:c.conditions??[],field,unit:'-',minimum:0,maximum:1,frameTimes:infos[k].frameTimes??undefined}));
  const options={camera,deformScale,timeSeconds,toleranceSeconds,output:{...defaultOutput,...output}};
  const preliminary=planCompareView(descriptors,options);
  const spec=(k,range)=>({field,deformScale,frameIndex:preliminary.panels[k].time.frameIndex,colorRange:range,camera});
  const auto=cases.map((c,k)=>renderCase(c.source,spec(k,null)));
  const described=descriptors.map((d,k)=>({...d,unit:auto[k].unit,minimum:auto[k].min,maximum:auto[k].max}));
  const shared=computeSharedRange(described);
  if(colorRange!==undefined&&colorRange!==null){
   if(colorRange.field!==field||!Number.isFinite(colorRange.minimum)||!Number.isFinite(colorRange.maximum)||colorRange.minimum>=colorRange.maximum||colorRange.unit!==undefined&&colorRange.unit!==shared.unit)throw Error('Invalid comparison color range or unit mismatch');
   shared.colorRange={field,minimum:colorRange.minimum,maximum:colorRange.maximum};shared.padded=false;
  }
  const shots=cases.map((c,k)=>renderCase(c.source,spec(k,shared.colorRange)));
  const plan=planCompareView(described,options);plan.colorRange=shared.colorRange;plan.rangePadded=shared.padded;if(Number.isFinite(timeSeconds)&&plan.panels.some(p=>p.time.timeApplies))plan.requestedTimeSeconds=timeSeconds;
  const canvas=createCanvas();drawComparison(canvas,plan,shots,shared,{colorAt,tr});
  const panels=plan.panels.map((p,k)=>({caseId:p.caseId,field,unit:auto[k].unit,minimum:auto[k].min,maximum:auto[k].max,...p.time,finalOnly:!!shots[k].finalOnly}));
  return {canvas,plan,panels,colorRange:shared.colorRange,unit:shared.unit};
 }};
}
function drawComparison(canvas,plan,shots,shared,{colorAt,tr}) {
    canvas.width = plan.size.width; canvas.height = plan.size.height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#102331'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#edf6f8'; g.font = '14px sans-serif';
    plan.panels.forEach((p, k) => {
      const v = p.rects.view, src = shots[k].canvas, s = Math.min(v.width / src.width, v.height / src.height), w = src.width * s, h = src.height * s;
      g.drawImage(src, v.x + (v.width - w) / 2, v.y + (v.height - h) / 2, w, h);
      p.labelLines.forEach((text, i) => g.fillText(text, p.rects.label.x + 8, p.rects.label.y + 20 + 18 * i, p.rects.label.width - 16));
    });
    const L = plan.legend, c = plan.colorRange, geo = legendBars(plan);
    geo.bars.forEach(({bar, minLabel, maxLabel}) => {
      const grad = g.createLinearGradient(bar.x, 0, bar.x + bar.width, 0);
      for (let i = 0; i <= 8; i++) grad.addColorStop(i / 8, colorAt(i / 8));
      g.fillStyle = grad; g.fillRect(bar.x, bar.y, bar.width, bar.height); g.fillStyle = '#edf6f8';
      g.textAlign = 'left'; g.fillText(`${formatQuantity(c.minimum)} ${shared.unit}`, minLabel.x, minLabel.y);
      g.textAlign = 'right'; g.fillText(`${formatQuantity(c.maximum)} ${shared.unit}`, maxLabel.x, maxLabel.y); g.textAlign = 'left';
    });
    const times = plan.panels.map((p, k) => shots[k].finalOnly ? tr('最終ステップのみ（共通時刻は適用されません）') : p.time.timeApplies ? `${formatSeconds(p.time.timeSeconds)} (${tr('保存フレームとのずれ')} ${formatSeconds(p.time.offsetSeconds, {signed: true})})` : tr('時間軸なし'));
    g.fillText(`${tr('共通色範囲')}: ${plan.field}${plan.rangePadded ? ' (padded)' : ''} · ${tr('変形倍率')} ${plan.deformScale}${plan.requestedTimeSeconds===undefined?'':` · ${tr('要求時刻')} ${formatSeconds(plan.requestedTimeSeconds)}`}`, 8, geo.textRows[0], L.width - 16);
    g.fillText(`${tr('物理時刻')}: ${times.join(' | ')}`, 8, geo.textRows[1], L.width - 16);
  }
