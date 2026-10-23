// Compare dedicated independent-linear increment bundles, never caller tables.
import {createIncrementCurveArtifacts,snapshotIncrementCurveBundle} from './increment-curve-export.js';

export const INCREMENT_CURVE_COMPARISON_LIMITS=Object.freeze({curves:4,inputBytes:2097152,artifactBytes:2097152});
const plain=value=>value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const bytes=value=>new TextEncoder().encode(value).length;
const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const short=value=>{const chars=Array.from(value);return chars.length>56?chars.slice(0,53).join('')+'…':value;};
const colours=Object.freeze(['#2563eb','#dc2626','#059669','#9333ea']);
const patterns=Object.freeze(['','8 4','3 3','9 3 2 3']);

function snapshotComparison(request){
  if(!plain(request)||Reflect.ownKeys(request).length!==1||!Object.hasOwn(request,'bundles'))throw Error('Curve comparison requires only bundles');
  const descriptor=Object.getOwnPropertyDescriptor(request,'bundles');
  if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('Comparison bundles must be a JSON data property');
  const list=descriptor.value;
  if(!Array.isArray(list)||list.length<2||list.length>INCREMENT_CURVE_COMPARISON_LIMITS.curves)throw Error('Curve comparison requires 2..4 bundles');
  if(Reflect.ownKeys(list).length!==list.length+1)throw Error('Comparison rejects sparse or decorated bundle arrays');
  const bundles=[];
  for(let i=0;i<list.length;i++){
    const entry=Object.getOwnPropertyDescriptor(list,String(i));
    if(!entry?.enumerable||!Object.hasOwn(entry,'value'))throw Error('Comparison bundle entries must be JSON data properties');
    bundles.push(snapshotIncrementCurveBundle(entry.value));
  }
  if(bytes(JSON.stringify({bundles}))>INCREMENT_CURVE_COMPARISON_LIMITS.inputBytes)throw Error('Curve comparison exceeds 2 MiB UTF-8 input limit');
  return bundles;
}

function globalScale(values,start,length,invert=false){
  let magnitude=1;
  for(const value of values)magnitude=Math.max(magnitude,Math.abs(value));
  let low=0,high=0;for(const value of values){low=Math.min(low,value/magnitude);high=Math.max(high,value/magnitude);}
  const span=high-low||1;
  return {position:value=>start+(invert?1-(value/magnitude-low)/span:(value/magnitude-low)/span)*length,tick:phase=>(low*(1-phase)+high*phase)*magnitude};
}
function plotSvg(comparison,{name,xField,yField,xUnit,yUnit,xData,yData,title,top}){
  const measured=comparison.curves.flatMap(curve=>curve.steps.filter(row=>row.status==='converged'));
  const x=globalScale(measured.map(row=>row[xField]),100,820),y=globalScale(measured.map(row=>row[yField]),top,250,true);
  const number=value=>Number(value.toFixed(6));
  const series=comparison.curves.map((curve,curveIndex)=>{
    const colour=colours[curveIndex],pattern=patterns[curveIndex],segments=[],points=[];let segment=[];
    const flush=()=>{if(segment.length>1)segments.push(`<path data-step-indices="${segment.map(row=>row.stepIndex).join(',')}" d="${segment.map((row,index)=>(index?'L':'M')+number(x.position(row[xField]))+' '+number(y.position(row[yField]))).join(' ')}" fill="none" stroke="${colour}" stroke-width="2"${pattern?` stroke-dasharray="${pattern}"`:''}/>`);segment=[];};
    for(const row of curve.steps){
      if(row.status!=='converged'){flush();continue;}
      segment.push(row);
      points.push(`<circle data-step-index="${row.stepIndex}" data-step-id="${xml(row.stepId)}" ${xData}="${row[xField]}" ${yData}="${row[yField]}" data-provisional="${row.provisional}" cx="${number(x.position(row[xField]))}" cy="${number(y.position(row[yField]))}" r="4" fill="${row.provisional?'white':colour}" stroke="${colour}" stroke-width="2"><title>${xml(curve.curveId)} / ${xml(row.stepId)}: ${row[xField]} ${xUnit}, ${row[yField]} ${yUnit}${row.provisional?' (provisional)':''}</title></circle>`);
    }
    flush();
    return `<g data-curve-index="${curveIndex}" data-curve-id="${xml(curve.curveId)}">${segments.join('\n')}\n${points.join('\n')}</g>`;
  });
  return `<g data-panel="${name}"><text x="100" y="${top-16}" font-size="14">${title}</text><path d="M100 ${top} V${top+250} H920" fill="none" stroke="#6b7280"/><text x="510" y="${top+292}" text-anchor="middle">${xField==='extensionMm'?'Gauge extension':'Engineering strain'} [${xUnit}]</text><text transform="translate(24 ${top+125}) rotate(-90)" text-anchor="middle">${yField==='tensileForceN'?'Tensile force':'Engineering stress'} [${yUnit}]</text>
${[0,0.25,0.5,0.75,1].map(phase=>`<text x="${number(x.position(x.tick(phase)))}" y="${top+270}" text-anchor="middle" font-size="10">${x.tick(phase).toPrecision(4)}</text><text x="92" y="${number(y.position(y.tick(phase)))}" text-anchor="end" font-size="10">${y.tick(phase).toPrecision(4)}</text>`).join('\n')}
${series.join('\n')}</g>`;
}
function makeComparisonSvg(comparison){
  const metadata={kind:comparison.kind,analysis:comparison.analysis,units:comparison.units,curves:comparison.curves.map(curve=>({curveId:curve.curveId,rowIdentity:curve.rowIdentity,axis:curve.axis,initialGaugeLengthMm:curve.initialGaugeLengthMm,initialAreaMm2:curve.initialAreaMm2,inputRevision:curve.inputRevision,meshRevision:curve.meshRevision,failedSteps:curve.steps.filter(row=>row.status==='failed').map(row=>({stepIndex:row.stepIndex,stepId:row.stepId}))}))};
  const legends=comparison.curves.map((curve,index)=>{
    const left=100+(index%2)*430,top=805+Math.floor(index/2)*66;
    const identity=`material: ${curve.rowIdentity.materialKey}; geometry: ${curve.rowIdentity.geometryKey}; gauge: ${curve.rowIdentity.gaugeKey}; L0=${curve.initialGaugeLengthMm} mm; A0=${curve.initialAreaMm2} mm^2; axis=${curve.axis.join(',')}`;
    return `<g data-legend-curve-index="${index}"><title>${xml(curve.curveId+' / '+identity)}</title><path d="M${left} ${top-5} h30" stroke="${colours[index]}" stroke-width="3"${patterns[index]?` stroke-dasharray="${patterns[index]}"`:''}/><text x="${left+38}" y="${top}" font-size="12">#${index+1} ${xml(short(curve.curveId))}</text><text x="${left}" y="${top+17}" font-size="10">${xml(short(identity))}</text><text x="${left}" y="${top+32}" font-size="10">L0=${curve.initialGaugeLengthMm} mm; A0=${curve.initialAreaMm2} mm^2; axis=${curve.axis.join(',')}</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="980" viewBox="0 0 1000 980" role="img" aria-labelledby="comparison-title comparison-desc">
<title id="comparison-title">Independent linear force-displacement and engineering stress-strain comparison</title>
<desc id="comparison-desc">${comparison.curves.length} separate coloured curves. Common mm/N axes above and dimensionless/Pa axes below. Failed steps break each line; hollow points are provisional. Different material, geometry, gauge and axis are permitted with explicit identities. plasticHistory:false. Engineering values are not true stress or plastic strain.</desc>
<metadata>${xml(JSON.stringify(metadata))}</metadata><rect width="1000" height="980" fill="white"/>
<g font-family="sans-serif" fill="#111827"><text x="100" y="25" font-size="16">Independent increment-curve comparison</text><text x="100" y="46" font-size="12">independent-linear-solves · plasticHistory:false · shared axes within each panel</text>
${plotSvg(comparison,{name:'force-displacement',xField:'extensionMm',yField:'tensileForceN',xUnit:'mm',yUnit:'N',xData:'data-extension-mm',yData:'data-force-n',title:'Force versus gauge extension',top:85})}
${plotSvg(comparison,{name:'engineering-stress-strain',xField:'engineeringStrain',yField:'engineeringStressPa',xUnit:'dimensionless',yUnit:'Pa',xData:'data-engineering-strain',yData:'data-engineering-stress-pa',title:'Engineering stress versus engineering strain',top:465})}
${legends.join('\n')}<text x="100" y="952" font-size="11">No interpolation, cross-curve lines or physical equivalence are implied. Full identities remain in JSON/SVG metadata.</text></g></svg>\n`;
}
/** Independently revalidate 2..4 raw increment bundles and emit bounded comparison artifacts. */
export async function createIncrementCurveComparison(request){
  // Snapshot every series before the first await, including later bundles.
  const snapshots=snapshotComparison(request);
  const artifacts=await Promise.all(snapshots.map(bundle=>createIncrementCurveArtifacts(bundle)));
  const ids=new Set();
  for(const {curve} of artifacts){if(ids.has(curve.curveId))throw Error('Comparison curveId must be unique');ids.add(curve.curveId);}
  const comparison=Object.freeze({schemaVersion:1,kind:'increment-curve-comparison',analysis:Object.freeze({kind:'independent-linear-solves',plasticHistory:false}),units:Object.freeze({extensionMm:'mm',forceN:'N',engineeringStrain:'dimensionless',engineeringStressPa:'Pa'}),curves:Object.freeze(artifacts.map(artifact=>artifact.curve))});
  const headerEnd=artifacts[0].csv.indexOf('\r\n')+2;
  const header=artifacts.some(artifact=>artifact.curve.steps.some(row=>row.controlledQuantity==='displacement'))?artifacts[0].csv.slice(0,headerEnd).replace('controlledValue[N]','controlledValue[controlledUnit]'):artifacts[0].csv.slice(0,headerEnd);
  const csv=header+artifacts.map(artifact=>artifact.csv.slice(artifact.csv.indexOf('\r\n')+2)).join('');
  const json=JSON.stringify(comparison,null,2)+'\n',svg=makeComparisonSvg(comparison);
  for(const artifact of [csv,json,svg])if(bytes(artifact)>INCREMENT_CURVE_COMPARISON_LIMITS.artifactBytes)throw Error('Comparison artifact exceeds 2 MiB UTF-8 limit');
  return Object.freeze({comparison,csv,json,svg});
}
