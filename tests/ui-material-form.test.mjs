import test from 'node:test';
import assert from 'node:assert/strict';
import {createMaterialFormUi} from '../src/ui/material-form-ui.js';

const materialFields=[{key:'youngModulus',label:'E',unit:'GPa',scale:1e9},{key:'density',label:'rho',unit:'',scale:1}];
function setup({props={},language='ja',physics='structural',readiness}={}){
 const nodes={};
 const $=id=>nodes[id]??=id==='material-fields'?{children:[],append(n){this.children.push(n);}}:{value:'',checked:false,textContent:''};
 $('material').value='steel';$('physics').value=physics;
 const doc={createElement:tag=>({tag,textContent:'',children:[],append(n){this.children.push(n);}})};
 const state={props,language};
 const ui=createMaterialFormUi({$,document:doc,materialFields,
  materialReadiness:readiness??(()=>({thermalMissing:[],linearElasticMissing:[],note:'N.'})),
  readFatigueMaterial:()=>({fatigue:true}),getMaterialProperties:()=>state.props,getLanguage:()=>state.language});
 return {ui,nodes,state,$};
}
function allFields(s){for(const id of ['plastic-enabled','plastic-yield','plastic-hardening','hyperelastic-enabled','hyperelastic-mu','hyperelastic-bulk','hyperelastic-curve','material-dependence','material-grade','material-source','material-notes','material-status','fatigue-enabled','mat-youngModulus','mat-density'])s.$(id);}

test('installFields appends one labelled number input per field',()=>{
 const s=setup();s.ui.installFields();
 const c=s.nodes['material-fields'].children;assert.equal(c.length,2);
 assert.equal(c[0].textContent,'E（GPa）');assert.equal(c[1].textContent,'rho');
 const input=c[0].children[0];assert.deepEqual([input.id,input.type,input.step,input.placeholder],['mat-youngModulus','number','any','未入力']);
});

test('writeForm shows defaults and scaled values',()=>{
 const s=setup({props:{youngModulus:200e9,grade:'S45C'}});allFields(s);s.ui.writeForm();
 assert.equal(s.nodes['mat-youngModulus'].value,200);assert.equal(s.nodes['mat-density'].value,'');
 assert.equal(s.nodes['material-grade'].value,'S45C');assert.equal(s.nodes['plastic-enabled'].checked,false);
 assert.equal(s.nodes['plastic-yield'].value,250);assert.equal(s.nodes['hyperelastic-mu'].value,.5);assert.equal(s.nodes['hyperelastic-bulk'].value,2);
 assert.equal(s.nodes['material-status'].textContent,'線形弾性の基本物性を登録済み。 N. 線形弾性のみ対応しています。');
});

test('writeForm status: thermal, missing, plasticity, orthotropic (language), hyperelastic precedence',()=>{
 const s=setup({physics:'thermal',readiness:()=>({thermalMissing:['k'],linearElasticMissing:[],note:''})});allFields(s);s.ui.writeForm();
 assert.equal(s.nodes['material-status'].textContent,'熱物性は不足しています。');
 const p=setup({props:{plasticity:{yieldStress:3e8,hardeningModulus:2e9,testConditions:'tc'}}});allFields(p);p.ui.writeForm();
 assert.equal(p.nodes['plastic-enabled'].checked,true);assert.equal(p.nodes['plastic-yield'].value,300);assert.equal(p.nodes['plastic-hardening'].value,2000);
 assert.equal(p.nodes['material-notes'].value,'tc');assert.match(p.nodes['material-status'].textContent,/^J2等方硬化/);
 p.state.props={orthotropic:{},plasticity:{yieldStress:1,hardeningModulus:1}};p.state.language='en';p.ui.writeForm();
 assert.match(p.nodes['material-status'].textContent,/^Orthotropic elasticity registered/);
 p.state.props={orthotropic:{},hyperelastic:{shearModulus:1e6,bulkModulus:4e6,testCurve:[1,2],testConditions:'h'}};p.ui.writeForm();
 assert.match(p.nodes['material-status'].textContent,/^圧縮性Neo-Hookean/);assert.equal(p.nodes['hyperelastic-curve'].value,'[1,2]');assert.equal(p.nodes['hyperelastic-mu'].value,1);assert.equal(p.nodes['material-notes'].value,'h');
});

test('orthotropic status states that no dedicated component editor exists without using isotropic or dependence fields',()=>{
 const s=setup({props:{orthotropic:{youngModuliPa:[210,220,230]}}});allFields(s);s.ui.writeForm();
 assert.match(s.nodes['material-status'].textContent,/専用の成分編集欄は未実装/);
 assert.match(s.nodes['material-status'].textContent,/APIまたは保存入力で各成分を確認/);
 assert.equal(s.nodes['mat-youngModulus'].value,'');assert.equal(s.nodes['material-dependence'].value,'');
 s.state.language='en';s.ui.writeForm();
 assert.match(s.nodes['material-status'].textContent,/Orthotropic elasticity registered/);
 assert.match(s.nodes['material-status'].textContent,/No dedicated per-component editor is implemented/);
});

test('readForm builds the registered shape and preserves orthotropic/fracture data by clone',()=>{
 const ortho={a:1},s=setup({props:{orthotropic:ortho,fractureData:{k:2}}});allFields(s);
 s.nodes['mat-youngModulus'].value='210';s.nodes['material-grade'].value='g';s.nodes['fatigue-enabled'].checked=true;
 s.nodes['plastic-enabled'].checked=true;s.nodes['plastic-yield'].value='300';s.nodes['plastic-hardening'].value='1000';s.nodes['material-notes'].value='n';
 s.nodes['hyperelastic-enabled'].checked=true;s.nodes['hyperelastic-mu'].value='1';s.nodes['hyperelastic-bulk'].value='2';s.nodes['hyperelastic-curve'].value=' [1] ';s.nodes['material-dependence'].value='{"t":1}';
 const p=s.ui.readForm();
 assert.deepEqual(p,{orthotropic:{a:1},fractureData:{k:2},youngModulus:210e9,density:null,grade:'g',source:'',notes:'n',fatigueData:{fatigue:true},
  plasticity:{model:'j2-isotropic',yieldStress:300e6,hardeningModulus:1000e6,testConditions:'n'},
  hyperelastic:{model:'neo-hookean-log',shearModulus:1e6,bulkModulus:2e6,testConditions:'n',testCurve:[1]},dependence:{t:1}});
 assert.notEqual(p.orthotropic,ortho);
 s.nodes['material-dependence'].value='bad';assert.throws(()=>s.ui.readForm(),SyntaxError);
});

test('readForm omits disabled sections',()=>{
 const s=setup();allFields(s);const p=s.ui.readForm();
 assert.deepEqual(Object.keys(p),['youngModulus','density','grade','source','notes']);
});
