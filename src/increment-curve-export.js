// Bounded offline artifacts, rebuilt from verified independent linear solve outputs.
// No DOM, solver, filesystem, download, interpolation or caller-supplied curve is used.
import {buildIncrementCurve} from './increment-curve-data.js';

export const INCREMENT_CURVE_EXPORT_LIMITS=Object.freeze({bundleBytes:1048576,steps:128,nodes:20000,depth:32,values:500000,stringLength:65536,artifactBytes:2097152});
const plain=value=>value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const bytes=value=>new TextEncoder().encode(value).length;
const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));

function checkedSnapshot(bundle){
  if(!plain(bundle)||Reflect.ownKeys(bundle).length!==2||!Object.hasOwn(bundle,'spec')||!Object.hasOwn(bundle,'steps'))throw Error('Curve export bundle must contain only spec and steps');
  let count=0;
  const ancestors=new Set();
  const visit=(value,depth)=>{
    if(++count>INCREMENT_CURVE_EXPORT_LIMITS.values||depth>INCREMENT_CURVE_EXPORT_LIMITS.depth)throw Error('Curve export JSON exceeds graph/depth limit');
    if(value===null||typeof value==='boolean')return;
    if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Curve export JSON requires finite numbers');return;}
    if(typeof value==='string'){
      if(value.length>INCREMENT_CURVE_EXPORT_LIMITS.stringLength)throw Error('Curve export string exceeds limit');
      for(const char of value){const code=char.codePointAt(0);if((code<32&&![9,10,13].includes(code))||(code>=0xd800&&code<=0xdfff)||code===0xfffe||code===0xffff)throw Error('Curve export text contains a character unsupported by XML');}
      return;
    }
    if(!Array.isArray(value)&&!plain(value))throw Error('Curve export requires plain JSON data');
    if(ancestors.has(value))throw Error('Curve export rejects cyclic JSON');
    if(Array.isArray(value)&&value.length>INCREMENT_CURVE_EXPORT_LIMITS.values)throw Error('Curve export array exceeds limit');
    ancestors.add(value);
    const keys=Reflect.ownKeys(value);
    if(keys.length>INCREMENT_CURVE_EXPORT_LIMITS.values)throw Error('Curve export object exceeds limit');
    for(const key of keys){
      if(Array.isArray(value)&&key==='length')continue;
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(typeof key!=='string'||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('Curve export rejects accessors, symbols and hidden properties');
      if(key.length>256)throw Error('Curve export property name exceeds limit');
      if(Array.isArray(value)&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length))throw Error('Curve export rejects decorated arrays');
      visit(key,depth+1);visit(descriptor.value,depth+1);
    }
    if(Array.isArray(value)&&keys.length!==value.length+1)throw Error('Curve export rejects sparse arrays');
    ancestors.delete(value);
  };
  visit(bundle,0);
  const serialized=JSON.stringify(bundle);
  if(bytes(serialized)>INCREMENT_CURVE_EXPORT_LIMITS.bundleBytes)throw Error('Curve export bundle exceeds 1 MiB UTF-8 limit');
  // The public boundary is JSON: normalise -0 just as saved/re-read JSON does.
  const snapshot=JSON.parse(serialized);
  if(!Array.isArray(snapshot.steps)||snapshot.steps.length<1||snapshot.steps.length>INCREMENT_CURVE_EXPORT_LIMITS.steps)throw Error('Curve export requires 1..128 steps');
  if(!Number.isInteger(snapshot.spec?.nodeCount)||snapshot.spec.nodeCount>INCREMENT_CURVE_EXPORT_LIMITS.nodes)throw Error('Curve export node count exceeds limit');
  return snapshot;
}

// Quotes alone do not prevent spreadsheet formula interpretation. Prefix dangerous
// *string* cells with an apostrophe; real numeric negative values remain numeric.
function csvCell(value){
  if(value===null)return '';
  if(typeof value==='number'||typeof value==='boolean')return String(value);
  const safe=/^[\s\uFEFF]*[=+\-@]/u.test(value)?"'"+value:value;
  return '"'+safe.replaceAll('"','""')+'"';
}
const columns=Object.freeze([
  ['curveId','curveId'],['analysisKind','analysisKind'],['plasticHistory','plasticHistory'],
  ['stepIndex','stepIndex'],['stepId','stepId'],['status','status'],['converged','converged'],['provisional','provisional'],
  ['controlledQuantity','controlledQuantity'],['controlledValue[N]','controlledValue'],['controlledUnit','controlledUnit'],
  ['extensionMm[mm]','extensionMm'],['tensileForceN[N]','tensileForceN'],['reactionAxisN[N]','reactionAxisN'],['appliedAxisN[N]','appliedAxisN'],['forceBalanceErrorNAxialN[N]','forceBalanceErrorNAxialN'],
  ['engineeringStressPa[Pa]','engineeringStressPa'],['engineeringStrain[dimensionless]','engineeringStrain'],
  ['initialGaugeLengthMm[mm]','initialGaugeLengthMm'],['initialAreaMm2[mm^2]','initialAreaMm2'],
  ['inputRevision','inputRevision'],['meshRevision','meshRevision'],['calculationRevision','calculationRevision'],['resultRevision','resultRevision']
]);
function makeCsv(curve){
  const lines=[columns.map(([heading])=>csvCell(heading)).join(',')];
  for(const row of curve.steps){
    const values={...row,curveId:curve.curveId,analysisKind:curve.analysis.kind,plasticHistory:false,initialGaugeLengthMm:curve.initialGaugeLengthMm,initialAreaMm2:curve.initialAreaMm2};
    lines.push(columns.map(([,key])=>csvCell(values[key])).join(','));
  }
  return lines.join('\r\n')+'\r\n';
}

// Normalise before subtracting, so finite values near ±Number.MAX_VALUE cannot
// overflow the plotted span to Infinity. Original numbers remain in data attrs.
function scale(values,start,length,invert=false){
  const magnitude=Math.max(1,...values.map(Math.abs));
  const low=Math.min(0,...values.map(value=>value/magnitude)),high=Math.max(0,...values.map(value=>value/magnitude));
  const span=high-low||1;
  return value=>start+(invert?1-(value/magnitude-low)/span:(value/magnitude-low)/span)*length;
}
function makeSvg(curve){
  const rows=curve.steps.filter(row=>row.status==='converged');
  const x=scale(rows.map(row=>row.extensionMm),95,650),y=scale(rows.map(row=>row.tensileForceN),80,330,true);
  const number=value=>Number(value.toFixed(6));
  const segments=[],points=[];let segment=[];
  const flush=()=>{if(segment.length>1)segments.push(`<path data-step-indices="${segment.map(row=>row.stepIndex).join(',')}" d="${segment.map((row,index)=>(index?'L':'M')+number(x(row.extensionMm))+' '+number(y(row.tensileForceN))).join(' ')}" fill="none" stroke="#3b82f6" stroke-width="2"/>`);segment=[];};
  for(const row of curve.steps){
    if(row.status!=='converged'){flush();continue;}
    segment.push(row);
    points.push(`<circle data-step-index="${row.stepIndex}" data-step-id="${xml(row.stepId)}" data-extension-mm="${row.extensionMm}" data-force-n="${row.tensileForceN}" data-provisional="${row.provisional}" cx="${number(x(row.extensionMm))}" cy="${number(y(row.tensileForceN))}" r="4" fill="${row.provisional?'#d97706':'#1d4ed8'}"><title>${xml(row.stepId)}: ${row.extensionMm} mm, ${row.tensileForceN} N${row.provisional?' (provisional)':''}</title></circle>`);
  }
  flush();
  const metadata={schemaVersion:curve.schemaVersion,curveId:curve.curveId,analysis:curve.analysis,inputRevision:curve.inputRevision,meshRevision:curve.meshRevision,units:{x:'mm',y:'N'},failedSteps:curve.steps.filter(row=>row.status==='failed').map(row=>({stepIndex:row.stepIndex,stepId:row.stepId}))};
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500" role="img" aria-labelledby="curve-title curve-desc">
<title id="curve-title">${xml(curve.curveId)} — force-displacement</title>
<desc id="curve-desc">Independent linear solves; plasticHistory:false. Failed steps break the line. Orange points are provisional. Gauge extension in mm; tensile reaction force in N.</desc>
<metadata>${xml(JSON.stringify(metadata))}</metadata>
<rect width="800" height="500" fill="white"/>
<g font-family="sans-serif" fill="#111827"><text x="95" y="28" font-size="16">${xml(curve.curveId)}</text>
<text x="95" y="49" font-size="12">independent-linear-solves · plasticHistory:false</text>
<path d="M95 80 V410 H745" fill="none" stroke="#6b7280"/>
<text x="420" y="452" text-anchor="middle">Gauge extension [mm]</text>
<text transform="translate(24 245) rotate(-90)" text-anchor="middle">Tensile force [N]</text>
<text x="95" y="478" font-size="12">${rows.length} converged / ${curve.steps.length-rows.length} failed; lines do not cross failed steps</text>
${[0,0.25,0.5,0.75,1].map(f=>{
    const xs=rows.map(row=>row.extensionMm),ys=rows.map(row=>row.tensileForceN);
    const minX=Math.min(0,...xs),maxX=Math.max(0,...xs),minY=Math.min(0,...ys),maxY=Math.max(0,...ys);
    const a=minX*(1-f)+maxX*f,b=minY*(1-f)+maxY*f;
    return `<text x="${number(x(a))}" y="430" text-anchor="middle" font-size="10">${a.toPrecision(4)}</text><text x="87" y="${number(y(b))}" text-anchor="end" font-size="10">${b.toPrecision(4)}</text>`;
  }).join('\n')}
${segments.join('\n')}
${points.join('\n')}
</g></svg>\n`;
}

/** Revalidate a bounded {spec,steps} JSON bundle and return immutable curve + UTF-8 artifact strings. */
export async function createIncrementCurveArtifacts(bundle){
  // Snapshot synchronously before hashing awaits: caller mutation cannot replace
  // the input/mesh/results between validation and the derived artifact revisions.
  const snapshot=checkedSnapshot(bundle);
  const curve=await buildIncrementCurve(snapshot);
  const csv=makeCsv(curve),json=JSON.stringify(curve,null,2)+'\n',svg=makeSvg(curve);
  for(const artifact of [csv,json,svg])if(bytes(artifact)>INCREMENT_CURVE_EXPORT_LIMITS.artifactBytes)throw Error('Curve export artifact exceeds size limit');
  return Object.freeze({curve,csv,json,svg});
}
