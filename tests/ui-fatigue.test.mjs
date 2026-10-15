import test from 'node:test';
import assert from 'node:assert/strict';
import {createFatigueUi} from '../src/ui/fatigue-ui.js';

function setup({props={},language='ja'}={}){
 const nodes={};
 const $=id=>nodes[id]??=id==='fatigue-summary'?{children:[],replaceChildren(){this.children=[];},append(n){this.children.push(n);}}:{value:'',checked:false};
 const doc={createElement:tag=>({tag,textContent:''})};
 const state={props,language};
 const ui=createFatigueUi({$,document:doc,getMaterialProperties:()=>state.props,getLanguage:()=>state.language});
 return {ui,nodes,state,$};
}
const fatigueData={model:'stress-life',snCurve:[[1e3,300e6],[1e6,100e6]],ultimateStrengthPa:500e6,yieldStressPa:300e6,source:'src',testConditions:'tc'};
const result={minLoadFactor:0,maxLoadFactor:1,appliedCycles:1000,meanStressCorrection:'goodman',minLifeCycles:12345.6789,maxDamage:0.5,stressAmplitudePa:[1e6,2e6],correctedAmplitudePa:[3e6,4e6],fatigueData:{source:'S',testConditions:'T'}};

test('renderFatigueMaterial fills the form from registered data and defaults when absent',()=>{
 const s=setup({props:{fatigueData}});s.ui.renderFatigueMaterial();
 assert.equal(s.nodes['fatigue-enabled'].checked,true);
 assert.equal(s.nodes['fatigue-curve'].value,JSON.stringify(fatigueData.snCurve,null,2));
 assert.equal(s.nodes['fatigue-ultimate'].value,500);assert.equal(s.nodes['fatigue-yield'].value,300);
 assert.equal(s.nodes['fatigue-source'].value,'src');assert.equal(s.nodes['fatigue-test-conditions'].value,'tc');
 s.state.props={};s.ui.renderFatigueMaterial();
 assert.equal(s.nodes['fatigue-enabled'].checked,false);assert.equal(s.nodes['fatigue-curve'].value,'');
 assert.equal(s.nodes['fatigue-ultimate'].value,400);assert.equal(s.nodes['fatigue-yield'].value,250);
 assert.equal(s.nodes['fatigue-source'].value,'');
});

test('readFatigueMaterial round-trips the form into the registered shape',()=>{
 const s=setup({props:{fatigueData}});s.ui.renderFatigueMaterial();
 assert.deepEqual(s.ui.readFatigueMaterial(),{model:'stress-life',stressRatio:-1,snCurve:fatigueData.snCurve,ultimateStrengthPa:500e6,yieldStressPa:300e6,source:'src',testConditions:'tc'});
 s.nodes['fatigue-curve'].value='not json';
 assert.throws(()=>s.ui.readFatigueMaterial(),SyntaxError);
});

test('renderFatigueResult clears on empty result and writes four paragraphs plus options',()=>{
 const s=setup();s.$('fatigue-summary').children.push('stale');
 s.ui.renderFatigueResult(null);assert.deepEqual(s.nodes['fatigue-summary'].children,[]);
 s.ui.renderFatigueResult(result);
 const c=s.nodes['fatigue-summary'].children;assert.equal(c.length,4);assert.ok(c.every(n=>n.tag==='p'));
 assert.equal(c[0].textContent,'最短疲労寿命: 12345.7 cycles / 最大損傷: 0.500000 / 最大応力振幅: 2.00000 MPa');
 assert.match(c[1].textContent,/^荷重倍率: 0 → 1 \/ 1000 cycles \/ 平均応力補正: goodman \/ 最大補正振幅: 4\.00000 MPa$/);
 assert.equal(c[2].textContent,'S-N出典: S / 試験条件: T');
 assert.equal(s.nodes['fatigue-min-factor'].value,0);assert.equal(s.nodes['fatigue-max-factor'].value,1);
 assert.equal(s.nodes['fatigue-cycles'].value,1000);assert.equal(s.nodes['fatigue-correction'].value,'goodman');
});

test('language is read at call time and zero-amplitude life is labelled',()=>{
 const s=setup();s.state.language='en';
 s.ui.renderFatigueResult({...result,minLifeCycles:null});
 const c=s.nodes['fatigue-summary'].children;
 assert.match(c[0].textContent,/^Shortest fatigue life: Zero amplitude \(life undefined\) \/ Maximum damage: /);
 assert.match(c[3].textContent,/^Constant-amplitude stress-life estimate/);
});
