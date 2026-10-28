import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSu2Vtu,summarizeSu2Result} from '../src/su2-vtu.js';
function fixture({badIndex=false,missingVelocity=false}={}){
 const chunks=[],declarations={Points:[],Cells:[],PointData:[]};let offset=0;
 const add=(section,name,type,components,values)=>{const size={Float32:4,Int32:4,UInt8:1}[type],data=Buffer.alloc(8+values.length*size);data.writeBigUInt64LE(BigInt(values.length*size));values.forEach((v,i)=>type==='Float32'?data.writeFloatLE(v,8+i*size):type==='Int32'?data.writeInt32LE(v,8+i*size):data.writeUInt8(v,8+i));chunks.push(data);declarations[section].push(`<DataArray type="${type}" Name="${name}" NumberOfComponents="${components}" offset="${offset}" format="appended"/>`);offset+=data.length;};
 add('Points','','Float32',3,[0,0,0,1,0,0,0,1,0,0,0,1]);add('Cells','connectivity','Int32',1,[0,1,2,badIndex?4:3]);add('Cells','offsets','Int32',1,[4]);add('Cells','types','UInt8',1,[10]);add('PointData','Pressure','Float32',1,[0,1,2,3]);if(!missingVelocity)add('PointData','Velocity','Float32',3,[1,0,0,1,0,0,1,0,0,1,0,0]);
 const header=`<VTKFile type="UnstructuredGrid" byte_order="LittleEndian" header_type="UInt64"><UnstructuredGrid><Piece NumberOfPoints="4" NumberOfCells="1">${Object.entries(declarations).map(([name,items])=>`<${name}>${items.join('')}</${name}>`).join('')}</Piece></UnstructuredGrid><AppendedData encoding="raw">_`;
 return Buffer.concat([Buffer.from(header),...chunks,Buffer.from('</AppendedData></VTKFile>')]);
}
test('SU2 appended VTU preserves signed pressure, velocities and connectivity',()=>{
 const volume=parseSu2Vtu(fixture());assert.deepEqual(volume.fields.Pressure.values,[0,1,2,3]);assert.deepEqual(volume.fields.Velocity.values.slice(0,3),[1,0,0]);assert.deepEqual(volume.connectivity,[0,1,2,3]);assert.equal(volume.pointCount,4);assert.equal(summarizeSu2Result(volume,volume).speedRange.maximum,1);
});
test('VTU refuses truncated, compressed, oversized and inconsistent fields',()=>{
 const bytes=fixture();assert.throws(()=>parseSu2Vtu(bytes.subarray(0,bytes.length-80)));assert.throws(()=>parseSu2Vtu(bytes,{maxPoints:3}),/limit/);assert.throws(()=>parseSu2Vtu(fixture({badIndex:true})),/connectivity/);assert.throws(()=>parseSu2Vtu(fixture({missingVelocity:true})),/velocity/);
 const compressed=Buffer.from(bytes.toString('latin1').replace('header_type="UInt64"','header_type="UInt64" compressor="vtkZLibDataCompressor"'),'latin1');assert.throws(()=>parseSu2Vtu(compressed),/encoding/);
});

test('wall y+ summary is dimensionless and never claims physical validation',()=>{
 const v=parseSu2Vtu(fixture()),s={...v,fields:{...v.fields,Y_Plus:{components:1,values:[.1,.4,.8,1.2]}}},r=summarizeSu2Result(v,s);assert.equal(r.wallYPlus.maximum,1.2);assert.equal(r.wallYPlus.aboveOne,1);assert.equal(r.wallYPlus.units,'dimensionless');assert.equal(r.physicalAccuracyVerified,false);
});
