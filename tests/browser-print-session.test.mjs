import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserMethods,createBrowserSession,connectBrowserSession} from '../src/browser-session.js';
import {createPrintOperations} from '../src/print-operations.js';
const text='G21\nG90\nM83\nG0 X0 Y0 Z.2\nG1 X10 E1 F600';
test('browser print methods route real import, inspect, bounded data and display settings under separate scopes',async()=>{
 let snapshot=null,view={viewId:'plate:0',allLayers:true,layerIndex:0};
 const prints=createPrintOperations({getSnapshot:()=>snapshot,commit:next=>{snapshot=next;},getView:()=>view,setView:next=>{view=next;}}),session=createBrowserSession({prints});
 assert.equal((await session.call('printInspect')).loaded,false);
 const imported=await session.call('importPrint',{expectedRevision:null,format:'gcode',filename:'test.gcode',text});assert.equal(imported.loaded,true);
 const page=await session.call('getPrintData',{expectedRevision:imported.revision,viewId:'plate:0',kind:'segments',limit:1});assert.equal(page.items.length,1);assert.deepEqual(page.items[0].to,[10,0,.2]);
 await session.call('setPrintView',{expectedRevision:imported.revision,settings:{allLayers:false,layerIndex:0}});assert.equal(view.allLayers,false);
 await assert.rejects(session.call('importPrint',{expectedRevision:null,format:'gcode',filename:'bad.gcode',text}),/conflict/);
 assert.equal(browserMethods.printInspect,'inspect');assert.equal(browserMethods.getPrintData,'inspect');assert.equal(browserMethods.importPrint,'edit');assert.equal(browserMethods.setPrintView,'view');
});
test('browser print mutations serialize, reject busy operations and observe disconnect/deadline guards',async()=>{
 let busy=true,resume,committed=false;
 const prints={import:async(_args,{guard})=>{await new Promise(resolve=>{resume=resolve;});if(!guard())throw Error('expired');committed=true;},set:()=>{committed=true;}},session=createBrowserSession({prints,isBusy:()=>busy});
 await assert.rejects(session.call('importPrint',{}),/busy/);await assert.rejects(session.call('setPrintView',{}),/busy/);busy=false;
 const pending=session.call('importPrint',{});await assert.rejects(session.call('setPrintView',{}),/busy/);session.disconnect();resume();await assert.rejects(pending,/expired/);assert.equal(committed,false);
 await assert.rejects(session.call('importPrint',{}, {expiresAt:Date.now()-1}),/expired/);
 const missing=createBrowserSession({});for(const method of ['printInspect','getPrintData','importPrint','setPrintView'])await assert.rejects(missing.call(method,{}),/unavailable/);
});
test('inspect-only browser connection refuses print import and view operations before adapter invocation',async()=>{
 let called=false,reply,finish;const done=new Promise(resolve=>{finish=resolve;});
 const session=createBrowserSession({prints:{import:()=>{called=true;},set:()=>{called=true;}}});
 const fetcher=async(url,options)=>{
  if(url.endsWith('/pair'))return {ok:true,json:async()=>({token:'token',sessionId:'session'})};
  if(url.endsWith('/poll'))return {ok:true,json:async()=>({commands:[{id:'import',method:'importPrint',args:{},expiresAt:Date.now()+5000},{id:'view',method:'setPrintView',args:{},expiresAt:Date.now()+5000}]})};
  if(url.endsWith('/reply')){reply=JSON.parse(options.body);assert.match(reply.error.message,/scope refused/);if(reply.id==='view')finish();return {ok:true,json:async()=>({})};}
  return {ok:true,json:async()=>({})};
 };
 const connection=connectBrowserSession({endpoint:'http://127.0.0.1:60000',pairingToken:'pair',scopes:['inspect'],session,fetcher});try{await connection.ready;await done;assert.equal(called,false);}finally{connection.stop();}
});
