import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createStudioApi} from '../src/studio-api.js';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {browserStudyControls,serializeBrowserStudy,applyBrowserStudy} from '../src/browser-study-state.js';
import {createStudyFormUi} from '../src/ui/study-form-ui.js';
const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
function htmlInitial(){return Object.fromEntries(Object.entries(browserStudyControls).map(([id,d])=>{
 if(d.type==='select'){const m=main.match(new RegExp('<select id="'+id+'">(.*?)</select>'));const options=[...m[1].matchAll(/<option\b([^>]*)>/g)];const sel=options.find(o=>/\bselected\b/.test(o[1]))??options[0];return [id,sel[1].match(/value="([^"]*)"/)[1]];}
 const input=main.match(new RegExp('<input\\b[^>]*\\bid="'+id+'"[^>]*>'));if(d.type==='checkbox')return [id,/\schecked(?:\s|>)/.test(input[0])];return [id,input[0].match(/\bvalue="([^"]*)"/)?.[1]??''];
}));}
// Mirrors main.js: study lives in DOM controls; get() serializes them, set() applies p.study to them.
function harness(){
 const nodes=Object.fromEntries(Object.entries(htmlInitial()).map(([id,v])=>[id,typeof v==='boolean'?{checked:v,value:''}:{value:v,checked:false}]));
 const $=id=>nodes[id];
 const form=createStudyFormUi({$,browserStudyControls});form.captureInitialStudyControls();
 const project=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]},name:'t'});
 let current={version:1,name:'t',material:'金属',materialProperties:{},meshSettings:{refinements:[]},meshes:project.meshes,conditions:[],selection:project.meshes.map(()=>[])};
 const get=()=>({...structuredClone(current),study:serializeBrowserStudy(form.readBrowserStudyControls(),{materialProperties:current.materialProperties})});
 const api=createStudioApi({get,set:p=>{current={...p};form.writeBrowserStudyControls(applyBrowserStudy(p.study,form.readBrowserStudyControls()).controlValues);}});
 return {api,form,get,$};
}
const acousticLoader=({api,get})=>{api.loadProject({...get(),study:{...get().study,kind:'acoustic',frequency:2000,sweep:false}});};
const modalStudy={kind:'structural',modalAnalysis:true,modeCount:2,modalIterations:60,gravityEnabled:false};

test('reproduces the bug: acoustic example spreading a stale modal study is rejected and leaves modal enabled',()=>{
 const h=harness();h.api.setStudy(modalStudy);assert.equal(h.$('modal-enabled').checked,true);
 assert.throws(()=>acousticLoader(h),/Modal analysis requires structural discipline/);
 assert.equal(h.get().study.kind,'structural');assert.equal(h.get().study.modalAnalysis,true);
});
test('after resetting study controls every prior-study state loads the acoustic example like a fresh load',()=>{
 const fresh=harness();acousticLoader(fresh);const expected=fresh.get().study;
 const priors=[modalStudy,{kind:'structural',nonlinearLoadSteps:10,maxNewtonIterations:30,gravityEnabled:true},{kind:'thermal',transient:true,steps:3},{kind:'acoustic',acousticTransient:true,exteriorRadiation:true},{kind:'channelFlow',flowAxis:2,pressureDropPa:3,dynamicViscosity:.001,fluidDensity:1000,fluidSoundSpeed:1500}];
 for(const prior of priors){const h=harness();h.api.setStudy(prior);h.form.resetBrowserStudyControls();acousticLoader(h);assert.deepEqual(h.get().study,expected,JSON.stringify(prior));}
});
test('main.js example bases reset study controls and the study form is captured at startup',()=>{
 assert.match(main,/createStudyFormUi\(\{\$,browserStudyControls,[^\n]*getOpeningCaps:[^\n]*restoreOpeningCaps:[^\n]*\}\);\s*captureInitialStudyControls\(\)/);
 for(const name of ['demo','analysisExample'])assert.match(main,new RegExp('function '+name+'\\(\\)\\{resetBrowserStudyControls\\(\\);'),name);
});
