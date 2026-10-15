// Deliberately narrow reader for uncompressed, appended-raw SU2 VTU output.
// It does not execute XML or accept arbitrary VTK encodings.
export function parseSu2Vtu(bytes,{maxBytes=100_000_000,maxPoints=500_000,maxCells=2_000_000}={}){
 if(!(bytes instanceof Uint8Array)||bytes.length>maxBytes)throw Error('VTU size limit');
 const text=new TextDecoder().decode(bytes.subarray(0,Math.min(bytes.length,65536)));
 const appended=text.indexOf('<AppendedData');if(appended<0)throw Error('VTU appended data missing');
 const end=text.indexOf('>',appended),start=text.indexOf('_',end)+1,header=text.slice(0,appended);
 if(start<=end||!/<VTKFile[^>]*type="UnstructuredGrid"/.test(header)||!header.includes('byte_order="LittleEndian"')||!header.includes('header_type="UInt64"')||/compressor=/.test(header)||!text.slice(appended,end).includes('encoding="raw"'))throw Error('Unsupported VTU encoding');
 // ASCII header means its character offsets equal byte offsets.
 const piece=header.match(/<Piece\s+NumberOfPoints="(\d+)"\s+NumberOfCells="(\d+)"/);
 if(!piece)throw Error('VTU piece missing');const pointCount=Number(piece[1]),cellCount=Number(piece[2]);
 if(pointCount<1||pointCount>maxPoints||cellCount<1||cellCount>maxCells)throw Error('VTU entity limit');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 function section(name){const m=header.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));if(!m)throw Error(`VTU ${name} missing`);return m[1];}
 function arrays(sectionText){const result={};for(const item of sectionText.matchAll(/<DataArray\b([^>]+)\/>/g)){
  const attrs=Object.fromEntries([...item[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)].map(m=>[m[1],m[2]]));
  const widths={Float32:4,Float64:8,Int32:4,UInt8:1},width=widths[attrs.type],offset=Number(attrs.offset),components=Number(attrs.NumberOfComponents);
  if(attrs.format!=='appended'||!width||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(components)||components<1||components>9)throw Error('Invalid VTU array declaration');
  const location=start+offset;if(location+8>bytes.length)throw Error('VTU array out of bounds');
  const length=Number(view.getBigUint64(location,true));if(!Number.isSafeInteger(length)||length%width||location+8+length>bytes.length)throw Error('VTU array length invalid');
  const count=length/width;if(count>maxCells*4||count%components)throw Error('VTU array entity limit');
  const values=new Array(count);for(let i=0;i<count;i++){const p=location+8+i*width;const v=attrs.type==='Float32'?view.getFloat32(p,true):attrs.type==='Float64'?view.getFloat64(p,true):attrs.type==='Int32'?view.getInt32(p,true):view.getUint8(p);if(!Number.isFinite(v))throw Error('Nonfinite VTU value');values[i]=v;}
  if(Object.hasOwn(result,attrs.Name))throw Error('Duplicate VTU array');result[attrs.Name]={components,values};
 }return result;}
 const points=arrays(section('Points'))['']?.values,cells=arrays(section('Cells')),fields=arrays(section('PointData'));
 if(points?.length!==pointCount*3||cells.offsets?.values.length!==cellCount||cells.types?.values.length!==cellCount)throw Error('VTU geometry count mismatch');
 const connectivity=cells.connectivity?.values;if(!connectivity||connectivity.some(i=>!Number.isInteger(i)||i<0||i>=pointCount))throw Error('Invalid VTU connectivity');
 let previous=0;for(let i=0;i<cellCount;i++){const offset=cells.offsets.values[i],size=({3:2,5:3,9:4,10:4})[cells.types.values[i]];if(!size||offset-previous!==size||offset>connectivity.length)throw Error('Unsupported or invalid VTU cell');previous=offset;}if(previous!==connectivity.length)throw Error('VTU trailing connectivity');
 for(const field of Object.values(fields))if(field.values.length!==pointCount*field.components)throw Error('VTU field count mismatch');
 if(fields.Pressure?.components!==1||fields.Velocity?.components!==3)throw Error('SU2 pressure/velocity missing');
 return {schemaVersion:1,pointCount,cellCount,points,connectivity,offsets:cells.offsets.values,types:cells.types.values,fields};
}
export function summarizeSu2Result(volume,surface){
 const range=values=>{let min=Infinity,max=-Infinity;for(const value of values){min=Math.min(min,value);max=Math.max(max,value);}return {minimum:min,maximum:max};};
 const velocity=[];for(let i=0;i<volume.pointCount;i++)velocity.push(Math.hypot(...volume.fields.Velocity.values.slice(i*3,i*3+3)));
 const yp=surface.fields.Y_Plus?.values,sorted=yp?[...yp].sort((a,b)=>a-b):null;
 const wallYPlus=sorted?.length?{units:'dimensionless',quantileMethod:'lower order statistic: floor((n-1)*p)',pointCount:sorted.length,minimum:sorted[0],median:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.floor((sorted.length-1)*.95)],maximum:sorted.at(-1),aboveOne:sorted.filter(v=>v>1).length,aboveFive:sorted.filter(v=>v>5).length,interpretation:'Instantaneous solver diagnostic; not convergence, mesh independence or physical validation.'}:null;
 return {schemaVersion:1,...(wallYPlus?{wallYPlus}:{}),coordinates:'m',pressure:'Pa (incompressible gauge)',velocity:'m/s',volumePoints:volume.pointCount,volumeCells:volume.cellCount,surfacePoints:surface.pointCount,surfaceCellCount:surface.cellCount,pressureRange:range(volume.fields.Pressure.values),surfacePressureRange:range(surface.fields.Pressure.values),speedRange:range(velocity),provisional:true,physicalAccuracyVerified:false};
}
