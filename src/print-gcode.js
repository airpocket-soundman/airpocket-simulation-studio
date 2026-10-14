// Read-only interpretation. No command is transmitted to a printer.
export function parsePrintGcode(text,{maxSegments=200000}={}){
 if(typeof text!=='string'||text.length>25000000||text.includes('\0')||!Number.isInteger(maxSegments)||maxSegments<1||maxSegments>200000)throw Error('G-code import requires text up to 25 MB and at most 200000 segments');
 const segments=[],settings={},warnings=new Set(),tools=new Map(),position=[null,null,null],offset=[0,0,0];let absolute=true,absoluteE=true,unit=1,feed=null,tool=0,feature='unclassified',layerNumber=null,motion=null,primingMm=0,extrusionMm=0,retractionMm=0,conditionalDepth=0;
 const state=()=>{if(!tools.has(tool))tools.set(tool,{e:null,debt:0});return tools.get(tool);};
 const lines=text.split(/\r?\n/);if(lines.length>1000000)throw Error('G-code line limit exceeded');
 function number(v){const n=Number(v);if(!Number.isFinite(n)||Math.abs(n)>1e10)throw Error('Invalid G-code numeric field');return n;}
 for(let lineNumber=0;lineNumber<lines.length;lineNumber++){
  const line=lines[lineNumber].trim(),parts=line.split(';'),comment=parts.slice(1).join(';').trim();let code=parts[0].replace(/\([^)]*\)/g,'').trim();
  const setting=comment.match(/^([A-Za-z][\w.]*)\s*=\s*(.{0,2000})$/);if(setting){if(Object.keys(settings).length>=500&&!Object.hasOwn(settings,setting[1]))throw Error('G-code setting limit exceeded');Object.defineProperty(settings,setting[1],{value:setting[2].trim(),enumerable:true,configurable:true,writable:true});}
  const type=comment.match(/^(?:TYPE|FEATURE)\s*:\s*(.{1,100})$/i);if(type)feature=type[1].trim();const layer=comment.match(/^(?:layer_number|layer num\/total_layer_count)\s*:\s*(\d+)/i);if(layer)layerNumber=number(layer[1]);
  if(!code)continue;code=code.replace(/^N\d+\s*/i,'').replace(/\*\d+\s*$/,'');
  const tokens=[...code.matchAll(/([A-Za-z])\s*([+-]?(?:\d+\.?\d*|\.\d+))/g)];if(!tokens.length){warnings.add('Unrecognized non-motion command');continue;}
  const command=tokens[0][1].toUpperCase(),commandNumber=number(tokens[0][2]),args={};for(const [,letter,value]of tokens.slice(1)){const k=letter.toUpperCase();if(Object.hasOwn(args,k)&&command!=='M')throw Error('Duplicate G-code coordinate field');args[k]=number(value);}
  let op=command+commandNumber;
  if(command==='G'&&args.G!==undefined)throw Error('Multiple G-code commands on one line are unsupported');
  if(op==='M622'){if(++conditionalDepth>20)throw Error('G-code conditional nesting limit exceeded');warnings.add('Conditional printer branches are recorded as possible paths, not executed paths');continue;}
  if(op==='M623'){if(!conditionalDepth)throw Error('Unmatched G-code conditional end');conditionalDepth--;continue;}
  if(['X','Y','Z','E','F'].includes(command)){if(motion===null)throw Error('G-code modal movement has no preceding motion command');if(Object.hasOwn(args,command))throw Error('Duplicate G-code coordinate field');args[command]=commandNumber;op='G'+motion;}
  if(op==='G90'){absolute=true;continue;}if(op==='G91'){absolute=false;continue;}if(op==='M82'){absoluteE=true;continue;}if(op==='M83'){absoluteE=false;continue;}if(op==='G20'){unit=25.4;continue;}if(op==='G21'){unit=1;continue;}
  if(command==='T'){if(commandNumber===1000){warnings.add('Bambu T1000 hardware operation is not simulated');continue;}if(!Number.isInteger(commandNumber)||commandNumber<0||commandNumber>255)throw Error('Invalid G-code tool index');tool=commandNumber;continue;}
  if(op==='G92'){for(const [k,axis]of [['X',0],['Y',1],['Z',2]])if(args[k]!==undefined){if(position[axis]===null)position[axis]=args[k]*unit;else offset[axis]=position[axis]-args[k]*unit;}if(args.E!==undefined)state().e=args.E*unit;continue;}
  if(['G28','G380','G381'].includes(op)){const axes=['X','Y','Z'].filter(k=>new RegExp(k+'(?:\\s|$|[+-]?\\d)','i').test(code));for(const k of axes.length?axes:['X','Y','Z']){position['XYZ'.indexOf(k)]=null;offset['XYZ'.indexOf(k)]=0;}warnings.add('Homing/probing coordinates are unknown until explicitly positioned');continue;}
  if(!['G0','G1','G2','G3'].includes(op)){
   if(command==='G'&&![4,17,18,19,29,80].includes(commandNumber)){throw Error('Unsupported G-code coordinate or motion command: '+op);}
   continue;
  }
  if(code.replace(/[A-Za-z]\s*[+-]?(?:\d+\.?\d*|\.\d+)/g,'').trim())throw Error('Malformed G-code motion field');
  const allowed=(op==='G2'||op==='G3')?'XYZEFIJKR':'XYZEF';if(Object.keys(args).some(k=>!allowed.includes(k)))throw Error('Unsupported G-code motion axis or parameter');
  motion=Number(op.slice(1));if(args.F!==undefined){feed=args.F*unit;if(!(feed>0))throw Error('G-code feed must be positive');}
  const previous=position.slice(),next=position.slice();let moved=false;
  for(const [k,axis]of [['X',0],['Y',1],['Z',2]])if(args[k]!==undefined){if(!absolute&&next[axis]===null)throw Error('Relative G-code motion requires known initial coordinates');next[axis]=absolute?args[k]*unit+offset[axis]:next[axis]+args[k]*unit;moved=true;}
  if(next.some(v=>v!==null&&(!Number.isFinite(v)||Math.abs(v)>1e6)))throw Error('G-code coordinates exceed the import range');
  let delta=0;const st=state();if(args.E!==undefined){const target=args.E*unit;if(absoluteE){if(st.e===null)throw Error('Absolute extrusion requires an explicit G92 E reference');delta=target-st.e;st.e=target;}else{delta=target;st.e=(st.e??0)+target;}}
  if(!Number.isFinite(delta))throw Error('Invalid G-code extrusion');if(delta<0){st.debt-=delta;retractionMm-=delta;}
  const paid=Math.min(st.debt,Math.max(0,delta));st.debt-=paid;const deposit=Math.max(0,delta-paid);position.splice(0,3,...next);
  if(op==='G2'||op==='G3'){if(deposit>0)throw Error('Extruding G2/G3 arcs are not supported; export linear G-code');warnings.add('Arc travel is omitted from the deposition preview');continue;}
  if(deposit<=0)continue;
  if(!moved||previous.every((v,i)=>v!==null&&v===next[i])){primingMm+=deposit;continue;}
  if(previous.some(v=>v===null)||next.some(v=>v===null))throw Error('Depositing G-code movement requires known XYZ coordinates');
  const from=previous.map((v,i)=>v+(next[i]-v)*(delta>0?paid/delta:0)),length=Math.hypot(...next.map((v,i)=>v-from[i]));if(length<=1e-12){primingMm+=deposit;continue;}
  if(segments.length>=maxSegments)throw Error('G-code deposition segment limit exceeded');
  segments.push({from,to:next.slice(),extrusionMm:deposit,lengthMm:length,feedMmMin:feed,tool,feature,layerNumber,lineNumber:lineNumber+1,conditionalDepth});extrusionMm+=deposit;
 }
 if(conditionalDepth)throw Error('G-code conditional block is incomplete');if(!segments.length)throw Error('G-code has no supported deposition paths');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const s of segments)for(const p of [s.from,s.to])for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
 const layers=[...new Set(segments.map(s=>s.layerNumber===null?'z:'+s.to[2].toFixed(6):'layer:'+s.layerNumber))];
 return {kind:'gcode',unit:'mm',segments,settings,boundsMm:[...min,...max],segmentCount:segments.length,layerCount:layers.length,extrusionMm,primingMm,retractionMm,tools:[...new Set(segments.map(s=>s.tool))].sort((a,b)=>a-b),warnings:[...warnings],interpretation:'Linear deposition paths; retraction recovery and stationary priming are excluded from deposited filament length'};
}
