import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {zipSync,strToU8} from 'three/addons/libs/fflate.module.js';
import {parsePrintGcode} from '../src/print-gcode.js';
import {parsePrint3mf} from '../src/print-3mf.js';
import {readPrintZip} from '../src/print-zip.js';
const xmlOptions={parseXml:text=>new DOMParser({onError:(_level,message)=>{throw Error(message);}}).parseFromString(text,'application/xml')};
const gcode='; layer_height = 0.2\n; sparse_infill_density = 15%\nG21\nG90\nM83\nG0 X0 Y0 Z0.2\n; layer num/total_layer_count: 1/2\n; FEATURE: Outer wall\nG1 X10 E1 F600\nG1 Y10 E1\nG1 E-2\nG1 X0 E3\nG0 Z0.4\n; layer num/total_layer_count: 2/2\n; FEATURE: Sparse infill\nG1 Y0 E1';
test('Bambu-style linear deposition handles retraction debt, features, layers and feed',()=>{
 const p=parsePrintGcode(gcode);assert.equal(p.segmentCount,4);assert.equal(p.extrusionMm,4);assert.equal(p.retractionMm,2);assert.equal(p.layerCount,2);assert.equal(p.settings.sparse_infill_density,'15%');assert.equal(p.segments[3].feature,'Sparse infill');assert.equal(p.segments[0].feedMmMin,600);assert.ok(Math.abs(p.segments[2].from[0]-10/3)<1e-12);assert.deepEqual(p.boundsMm,[0,0,.2,10,10,.4]);
});
test('G-code absolute extrusion, relative coordinates, inches and G92 preserve physical path continuity',()=>{
 const p=parsePrintGcode('G20\nG90\nM82\nG92 E0\nG0 X0 Y0 Z0\nG1 X1 E1 F60\nG92 X10\nG1 X11 E2\nG91\nG1 Y1 E3');assert.equal(p.segmentCount,3);assert.deepEqual(p.segments[0].to,[25.4,0,0]);assert.ok(Math.abs(p.segments[1].to[0]-50.8)<1e-12);assert.ok(p.segments[2].to.every((v,i)=>Math.abs(v-[50.8,25.4,0][i])<1e-12));assert.ok(Math.abs(p.extrusionMm-76.2)<1e-12);assert.equal(p.segments[0].feedMmMin,1524);
});
test('stationary priming and hardware commands do not become deposited geometry',()=>{
 const p=parsePrintGcode('M83\nG1 E5\nT1000\nM970.3 Q0 A7 B30 Q0 H15\nG380 S2 Z30\nG0 X0 Y0 Z.2\nG0 X10 E1 F300');assert.equal(p.primingMm,5);assert.equal(p.extrusionMm,1);assert.equal(p.segmentCount,1);assert.deepEqual(p.tools,[0]);assert.equal(p.warnings.length,2);
});
test('conditional printer paths are marked and incomplete or repeated coordinate commands are refused',()=>{
 const p=parsePrintGcode('M83\nG0 X0 Y0 Z.2\nM622 J1\nG1 X10 E1\nM623\nG1 Y10 E1');assert.deepEqual(p.segments.map(s=>s.conditionalDepth),[1,0]);assert.ok(p.warnings.some(v=>v.includes('possible paths')));for(const code of ['M622 J1\n'+gcode,'M623\n'+gcode,'G90 G1 X1\n'+gcode])assert.throws(()=>parsePrintGcode(code));
});
test('unknown coordinates, unsupported extrusion arcs, corrupt values and count limits are refused',()=>{
 for(const code of ['M83\nG1 X10 E1','G91\nM83\nG1 X1 E1','G0 X0 Y0 Z0\nG1 X1 E1','G0 X0 Y0 Z0\nM83\nG2 X1 E1 I.5','G0 X0 Y0 Z0\nM83\nG1 XNaN E1','G0 X0 Y0 Z0\nM83\nG1 X1 X2 E1','G54\n'+gcode])assert.throws(()=>parsePrintGcode(code));assert.throws(()=>parsePrintGcode(gcode,{maxSegments:1}),/limit/);
});
const ns='http://schemas.microsoft.com/3dmanufacturing/core/2015/02',prod='http://schemas.microsoft.com/3dmanufacturing/production/2015/06';
const mesh='<mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh>';
const model=(resources,build,unit='millimeter')=>`<model xmlns="${ns}" xmlns:p="${prod}" unit="${unit}"><resources>${resources}</resources><build>${build}</build></model>`;
const rels='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
const pack=files=>zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])));
test('3MF build/component transforms, units, production paths and mirrored winding follow the model tree',()=>{
 const data=pack({'_rels/.rels':rels,'3D/3dmodel.model':model('<object id="1"><components><component objectid="2" p:path="/3D/Objects/a.model" transform="-1 0 0 0 1 0 0 0 1 3 0 0"/></components></object>','<item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 2 0"/>','inch'),'3D/Objects/a.model':model('<object id="2">'+mesh+'</object>','','inch')});const p=parsePrint3mf(data,xmlOptions);assert.equal(p.triangleCount,1);assert.deepEqual(p.geometries[0].positions,[76.19999999999999,50.8,0,76.19999999999999,76.19999999999999,0,50.8,50.8,0]);assert.equal(p.unit,'mm');
});
test('Bambu project/model settings and packaged plate G-code are extracted without inventing material properties',()=>{
 const p=parsePrint3mf(pack({'_rels/.rels':rels,'3D/3dmodel.model':model('<object id="1">'+mesh+'</object>','<item objectid="1"/>'),'Metadata/project_settings.config':JSON.stringify({layer_height:'0.2',sparse_infill_density:'15%',filament_type:['PLA']}),'Metadata/model_settings.config':'<config><object id="1"><metadata key="wall_loops" value="3"/></object></config>','Metadata/plate_1.gcode':gcode}),xmlOptions);assert.equal(p.geometries.length,1);assert.equal(p.plates[0].layerCount,2);assert.equal(p.settings.project.layer_height,'0.2');assert.deepEqual(p.settings.objects,[{objectId:'1',key:'wall_loops',value:'3'}]);assert.equal(p.materialProperties,undefined);
});
test('3MF cycles, broken indices, external links, entities, unknown units and malformed transforms are rejected',()=>{
 const cyclic=model('<object id="1"><components><component objectid="1"/></components></object>','<item objectid="1"/>');for(const text of [cyclic,model('<object id="1">'+mesh.replace('v3="2"','v3="9"')+'</object>','<item objectid="1"/>'),model('<object id="1">'+mesh+'</object>','<item objectid="1"/>','unknown'),model('<object id="1">'+mesh+'</object>','<item objectid="1" transform="0 0 0 0 0 0 0 0 0 0 0 0"/>'),'<!DOCTYPE model [<!ENTITY x "boom">]>'+model('<object id="1">'+mesh+'</object>','<item objectid="1"/>')])assert.throws(()=>parsePrint3mf(pack({'_rels/.rels':rels,'3D/3dmodel.model':text}),xmlOptions));assert.throws(()=>parsePrint3mf(pack({'_rels/.rels':rels.replace('/3D/3dmodel.model','https://example.org/a.model').replace('Id="r1"','Id="r1" TargetMode="External"')}),xmlOptions),/External/);
});
test('ZIP validates paths, CRC, local headers and declared decompressed sizes before exposing parts',()=>{
 assert.throws(()=>readPrintZip(pack({'../outside':'text'})),/path/);const original=zipSync({'a.model':strToU8('example')},{level:0}),broken=original.slice();broken[30+'a.model'.length]^=1;assert.throws(()=>readPrintZip(broken).read('a.model'),/CRC/);
 const compressed=pack({'large.model':'z'.repeat(50000)}),bad=compressed.slice(),view=new DataView(bad.buffer),central=view.getUint32(bad.length-22+16,true);view.setUint32(central+24,4,true);view.setUint32(view.getUint32(central+42,true)+22,4,true);assert.throws(()=>readPrintZip(bad).read('large.model'),/declared/);
});
test('bounded single-disk ZIP64 offsets support small Bambu-style archives and reject corrupt locators',()=>{
 const ordinary=pack({'a.model':'reference'}),old=new DataView(ordinary.buffer),end=ordinary.length-22,z=new Uint8Array(56),zv=new DataView(z.buffer),locator=new Uint8Array(20),lv=new DataView(locator.buffer),legacy=ordinary.slice(end),ev=new DataView(legacy.buffer);
 zv.setUint32(0,0x06064b50,true);zv.setBigUint64(4,44n,true);zv.setUint16(12,45,true);zv.setUint16(14,45,true);zv.setBigUint64(24,BigInt(old.getUint16(end+10,true)),true);zv.setBigUint64(32,BigInt(old.getUint16(end+10,true)),true);zv.setBigUint64(40,BigInt(old.getUint32(end+12,true)),true);zv.setBigUint64(48,BigInt(old.getUint32(end+16,true)),true);lv.setUint32(0,0x07064b50,true);lv.setBigUint64(8,BigInt(end),true);lv.setUint32(16,1,true);ev.setUint32(16,0xffffffff,true);const wide=new Uint8Array(end+98);wide.set(ordinary.subarray(0,end));wide.set(z,end);wide.set(locator,end+56);wide.set(legacy,end+76);assert.equal(new TextDecoder().decode(readPrintZip(wide).read('a.model')),'reference');const bad=wide.slice();new DataView(bad.buffer).setBigUint64(end+56+8,BigInt(bad.length+1),true);assert.throws(()=>readPrintZip(bad),/ZIP64/);
});
