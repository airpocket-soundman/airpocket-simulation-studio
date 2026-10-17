import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeAcousticResolution,analyzeComponentAnchoring,meshConnectedComponents,ELEMENTS_PER_WAVELENGTH_WARN,ELEMENTS_PER_WAVELENGTH_REFUSE} from '../src/mesh-resolution-preflight.js';
import {preflightMeshBoundaryTransfer} from '../src/mesh-boundary-preflight.js';
import {getProjectRevision} from '../src/project-revision.js';

// Two disjoint tetrahedra with edge length h mm (nodes 0-3 and 4-7).
const twoTets=(h=10)=>({nodes:[0,0,0,h,0,0,0,h,0,0,0,h, 100,0,0,100+h,0,0,100,h,0,100,0,h],tetrahedra:[[0,1,2,3],[4,5,6,7]],surface:[]});
const acoustic=(extra={})=>({study:{kind:'acoustic',acousticTransient:false,sweep:false,frequency:1000,soundSpeed:343,airDensity:1.2,...extra}});

test('connected components follow tetrahedron connectivity and reject invalid meshes',()=>{
 assert.deepEqual(meshConnectedComponents(twoTets()),[[0,1,2,3],[4,5,6,7]]);
 const joined=twoTets();joined.tetrahedra.push([3,4,5,6]);assert.equal(meshConnectedComponents(joined).length,1);
 assert.equal(meshConnectedComponents({nodes:[0,0,0],tetrahedra:[[0,1,2,3]]}),null);assert.equal(meshConnectedComponents({nodes:[0,0,0]}),null);
});

test('acoustic elements per wavelength: solver-aligned pass / refusal at six elements per wavelength',()=>{
 assert.equal(ELEMENTS_PER_WAVELENGTH_WARN,6);assert.equal(ELEMENTS_PER_WAVELENGTH_REFUSE,6);
 // wavelength = 343 mm at 1 kHz
 const ok=analyzeAcousticResolution({project:acoustic(),mesh:twoTets(10)});assert.equal(ok.report.status,'checked');assert.equal(ok.report.level,'ok');assert.ok(ok.report.wavelengthMm<343&&ok.report.wavelengthMm>342);assert.ok(ok.report.maxEdgeMm>=10);assert.deepEqual(ok.diagnostics,[]);
 const warn=analyzeAcousticResolution({project:acoustic(),mesh:twoTets(100)});assert.equal(warn.report.level,'refuse');assert.equal(warn.diagnostics[0].code,'ACOUSTIC_MESH_WAVELENGTH_UNRESOLVED');assert.equal(warn.diagnostics[0].severity,'error');
 const refuse=analyzeAcousticResolution({project:acoustic({frequency:10000}),mesh:twoTets(100)});assert.equal(refuse.report.level,'refuse');assert.equal(refuse.diagnostics[0].code,'ACOUSTIC_MESH_WAVELENGTH_UNRESOLVED');assert.equal(refuse.diagnostics[0].severity,'error');
 const sweep=analyzeAcousticResolution({project:acoustic({sweep:true,sweepStart:100,sweepEnd:10000,sweepCount:5}),mesh:twoTets(100)});assert.equal(sweep.report.level,'refuse');assert.equal(sweep.report.highestFrequencyOf,'sweep');
});

test('acoustic resolution is warning-only when unsure and not applicable to other physics',()=>{
 for(const [project,mesh] of [[acoustic({acousticTransient:true,pulseWidth:0}),twoTets()],[acoustic({frequency:undefined}),twoTets()],[acoustic(),{nodes:[],tetrahedra:[]}],[acoustic(),twoTets(0)]]){const r=analyzeAcousticResolution({project,mesh});assert.equal(r.report.status,'unknown');assert.equal(r.diagnostics[0].code,'ACOUSTIC_RESOLUTION_CHECK_UNAVAILABLE');assert.equal(r.diagnostics[0].severity,'warning');}
 assert.equal(analyzeAcousticResolution({project:{study:{kind:'thermal'}},mesh:twoTets()}).report.status,'not-applicable');
});

test('component anchoring: structural and steady thermal report unanchored components; transient/other are not applicable',()=>{
 const mesh=twoTets(),structural={study:{kind:'structural'}};
 const one=analyzeComponentAnchoring({project:structural,mesh,boundary:{fixed:[0],displacements:[]}});assert.equal(one.report.componentCount,2);assert.equal(one.report.unanchoredComponentCount,1);assert.equal(one.diagnostics[0].code,'MESH_COMPONENT_UNANCHORED');assert.equal(one.diagnostics[0].severity,'error');assert.deepEqual(one.diagnostics[0].evidence.unanchoredComponents.map(c=>c.index),[1]);
 const both=analyzeComponentAnchoring({project:structural,mesh,boundary:{fixed:[0],displacements:[{node:5,direction:[1,0,0],valueMm:0}]}});assert.equal(both.report.unanchoredComponentCount,0);assert.deepEqual(both.diagnostics,[]);
 const thermal={study:{kind:'thermal',transient:false}};
 const t1=analyzeComponentAnchoring({project:thermal,mesh,boundary:{temperatures:[[0,20]],heatFlux:[[5,1]],convection:[],radiation:[],contacts:[]}});assert.equal(t1.report.unanchoredComponentCount,1,'heat flux alone does not anchor');assert.equal(t1.diagnostics[0].severity,'error');
 const t2=analyzeComponentAnchoring({project:thermal,mesh,boundary:{temperatures:[[0,20]],convection:[{nodes:[4,5,6]}],radiation:[],contacts:[]}});assert.equal(t2.report.unanchoredComponentCount,0);
 const t3=analyzeComponentAnchoring({project:thermal,mesh,boundary:{temperatures:[[0,20]],convection:[],radiation:[],contacts:[{}]}});assert.equal(t3.diagnostics[0].severity,'error');assert.equal(t3.diagnostics[0].code,'COMPONENT_ANCHORING_CONTACT_INVALID');
 assert.equal(analyzeComponentAnchoring({project:{study:{kind:'thermal',transient:true}},mesh,boundary:{}}).report.status,'not-applicable');
 assert.equal(analyzeComponentAnchoring({project:acoustic(),mesh,boundary:{}}).report.status,'not-applicable');
 assert.equal(analyzeComponentAnchoring({project:{study:{kind:'structural',modalAnalysis:true}},mesh,boundary:{}}).report.status,'not-applicable');
 const bad=analyzeComponentAnchoring({project:structural,mesh:{nodes:[0,0,0]},boundary:{}});assert.equal(bad.report.status,'unknown');assert.equal(bad.diagnostics[0].severity,'warning');
});

async function inspect(project,mesh){
 const unloaded=structuredClone(project);unloaded.conditions=[];const revision=await getProjectRevision(unloaded);
 return preflightMeshBoundaryTransfer({project:unloaded,job:{jobId:'m',inputRevision:revision,state:'succeeded',executionSettled:true,operation:'mesh'},output:{input:unloaded,mesh},expectedRevision:revision});
}

test('post-mesh checks flow through the existing preflight result without breaking existing fields',async()=>{
 const base={version:1,sourceModel:{kind:'box',bounds:[0,0,0,1,1,1]},materialProperties:{youngModulus:1e9,poissonRatio:.25},meshes:[],selection:[[]],conditions:[]};
 const ac=await inspect({...base,...acoustic({frequency:10000})},twoTets(100));
 assert.equal(ac.allowed,false);assert.equal(ac.acousticResolution.level,'refuse');assert.ok(ac.diagnostics.some(d=>d.code==='ACOUSTIC_MESH_WAVELENGTH_UNRESOLVED'));assert.equal(ac.completePreflight,false);assert.equal(ac.schemaVersion,1);assert.ok(Array.isArray(ac.reports)&&Array.isArray(ac.remainingChecks)&&ac.rigidBody);assert.equal(ac.rigidBody.status,'not-applicable');
 const acWarn=await inspect({...base,...acoustic()},twoTets(100));assert.equal(acWarn.allowed,false);assert.equal(acWarn.diagnostics[0].code,'ACOUSTIC_MESH_WAVELENGTH_UNRESOLVED');
 const th=await inspect({...base,study:{kind:'thermal',transient:false}},twoTets());
 assert.equal(th.allowed,false);assert.equal(th.componentAnchoring.unanchoredComponentCount,2);assert.ok(th.diagnostics.some(d=>d.code==='MESH_COMPONENT_UNANCHORED'));assert.equal(th.acousticResolution.status,'not-applicable');
 const st=await inspect({...base,study:{kind:'structural',gravityEnabled:false}},twoTets());assert.equal(st.componentAnchoring.unanchoredComponentCount,2);assert.ok(st.diagnostics.some(d=>d.code==='ANALYSIS_RIGID_BODY_MODE_FREE'));
 const modal=await inspect({...base,study:{kind:'thermal',modalAnalysis:true}},twoTets());assert.equal(modal.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_MODEL_UNSUPPORTED');
});
