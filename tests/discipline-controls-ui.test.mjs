import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDisciplineControlsUi} from '../src/ui/discipline-controls-ui.js';

function harness(){
 const elements=new Map(),options=new Map([['webgpu-pcg',{disabled:false}],['mfem-wasm',{disabled:false}]]),sections=['structural','thermal','channelFlow','creepingFlow','modal','acoustic'].map(kind=>({dataset:{physics:kind},tagName:'DETAILS',hidden:false,open:false}));
 const element=id=>{if(!elements.has(id)){let value='';elements.set(id,{get value(){return value;},set value(next){value=String(next);},disabled:false,checked:false});}return elements.get(id);};
 let state={kind:'structural',conditions:[],materialProperties:{},sourceModel:null,running:false,modalEnabled:false,solver:'wasm-pcg'};
 const update=createDisciplineControlsUi({$:element,querySelector:selector=>options.get(selector.match(/value="([^"]+)/)?.[1]),querySelectorAll:()=>sections,getState:()=>state});
 return {elements,element,options,sections,setState:next=>state={...state,...next},update};
}

test('discipline changes update solver, adaptive, material controls and section visibility for each physics',()=>{
 const h=harness();
 h.update();
 assert.equal(h.element('solve-run').disabled,false);
 assert.equal(h.element('adaptive-run').disabled,false);
 assert.equal(h.sections.find(s=>s.dataset.physics==='structural').hidden,false);
 h.setState({kind:'thermal',solver:'webgpu-pcg'});h.update();
 assert.equal(h.element('adaptive-run').disabled,true);
 assert.equal(h.element('adaptive-run').checked,false);
 assert.equal(h.options.get('webgpu-pcg').disabled,true);
 assert.equal(h.element('solver').value,'wasm-pcg');
 assert.equal(h.sections.find(s=>s.dataset.physics==='structural').hidden,true);
 assert.equal(h.sections.find(s=>s.dataset.physics==='thermal').hidden,false);
 h.setState({kind:'channelFlow'});h.update();
 assert.equal(h.sections.find(s=>s.dataset.physics==='channelFlow').hidden,false);
 assert.equal(h.sections.find(s=>s.dataset.physics==='channelFlow').open,true);
 h.sections.find(s=>s.dataset.physics==='channelFlow').open=false;
 h.setState({kind:'structural'});h.update();
 assert.equal(h.sections.find(s=>s.dataset.physics==='channelFlow').hidden,true);
 assert.equal(h.sections.find(s=>s.dataset.physics==='channelFlow').open,false);
 h.setState({kind:'creepingFlow'});h.update();
 assert.equal(h.sections.find(s=>s.dataset.physics==='creepingFlow').open,true);
 h.setState({kind:'modal'});h.update();
 assert.equal(h.sections.find(s=>s.dataset.physics==='modal').hidden,false);
 assert.equal(h.element('adaptive-run').checked,false);
});

test('modal, plastic and hyperelastic structural states disable special solvers and adaptive runs',()=>{
 const h=harness();
 h.setState({solver:'webgpu-pcg',modalEnabled:true});h.update();
 assert.equal(h.options.get('webgpu-pcg').disabled,true);
 assert.equal(h.options.get('mfem-wasm').disabled,true);
 assert.equal(h.element('solver').value,'wasm-pcg');
 assert.equal(h.element('adaptive-run').disabled,true);
 h.setState({modalEnabled:false,materialProperties:{plasticity:{model:'j2'}}});
 h.element('adaptive-run').checked=true;h.update();
 assert.equal(h.element('plastic-load-fractions').disabled,false);
 assert.equal(h.element('adaptive-run').checked,false);
 h.setState({materialProperties:{hyperelastic:{model:'neo-hookean'}}});h.update();
 assert.equal(h.element('adaptive-run').disabled,true);
});

test('STL, load fractions and nonlinear step controls preserve their transition behavior',()=>{
 const h=harness();
 h.setState({materialProperties:{plasticity:{model:'j2'}},sourceModel:{kind:'stl'}});
 h.element('plastic-load-fractions').value='0.5,1';h.element('nonlinear-steps').value='9';h.element('adaptive-run').checked=true;
 h.update();
 assert.equal(h.element('adaptive-run').disabled,true);
 assert.equal(h.element('adaptive-run').checked,false);
 assert.equal(h.element('nonlinear-steps').disabled,true);
 assert.equal(h.element('nonlinear-steps').value,'2');
 h.setState({kind:'thermal'});h.update();
 assert.equal(h.element('plastic-load-fractions').disabled,true);
 assert.equal(h.element('plastic-load-fractions').value,'');
 assert.equal(h.element('nonlinear-steps').disabled,false);
 assert.equal(h.element('nonlinear-steps').value,'2');
 h.setState({kind:'structural',sourceModel:{kind:'step'}});h.element('plastic-load-fractions').value='0.25,0.5,1';h.update();
 assert.equal(h.element('nonlinear-steps').disabled,true);
 assert.equal(h.element('nonlinear-steps').value,'3');
});

test('active jobs retain run-button state while CAD conditions gate the next run',()=>{
 const h=harness();
 h.element('solve-run').disabled=false;
 h.setState({running:true,conditions:[{cadUpdateRequired:true}]});h.update();
 assert.equal(h.element('solve-run').disabled,false);
 h.setState({running:false});h.update();
 assert.equal(h.element('solve-run').disabled,true);
 h.setState({kind:'fluidDomain',conditions:[]});h.update();
 assert.equal(h.element('solve-run').disabled,true);
 h.setState({kind:'structural',conditions:[]});h.update();
 assert.equal(h.element('solve-run').disabled,false);
});
