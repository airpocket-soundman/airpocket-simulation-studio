import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserMethods,createBrowserSession} from '../src/browser-session.js';

test('case archive routes preserve paging and private guards and release imports on disconnect',async()=>{
 const calls=[],caseArchives={beginExport:(args,options)=>{assert.equal(options.guard(),true);return {transferId:'out'};},read:args=>{calls.push(args);return {data:'AA=='};},beginImport:(args,options)=>{assert.equal(options.guard(),true);return {transferId:'in'};},write:(args,options)=>{assert.equal(options.guard(),true);return {nextOffset:1};},commit:(args,options)=>{assert.equal(options.guard(),true);return {imported:true};},release:args=>{calls.push(['release',args.transferId]);return {released:true};}};
 const session=createBrowserSession({caseArchives});
 assert.equal((await session.call('caseArchiveExport')).transferId,'out');
 assert.equal((await session.call('caseArchiveRead',{transferId:'out',offset:65536,length:32})).data,'AA==');
 assert.deepEqual(calls[0],{transferId:'out',offset:65536,length:32});
 await session.call('caseArchiveImport',{});await session.call('caseArchiveWrite',{transferId:'in',offset:0,data:'AA=='});assert.equal((await session.call('caseArchiveCommit',{transferId:'in'})).imported,true);
 session.disconnect();assert.deepEqual(calls.at(-1),['release','in']);
 for(const method of ['caseArchiveExport','caseArchiveRead','caseArchiveRelease'])assert.equal(browserMethods[method],'inspect');
 for(const method of ['caseArchiveImport','caseArchiveWrite','caseArchiveCommit'])assert.equal(browserMethods[method],'edit');
});

test('pending archive commit is revoked and concurrent project/view mutations remain excluded',async()=>{
 let resume,entered=false,applied=false;
 const session=createBrowserSession({caseArchives:{commit:async(args,{guard})=>{entered=true;await new Promise(resolve=>{resume=resolve;});if(!guard())throw Error('revoked');applied=true;}}});
 const commit=session.call('caseArchiveCommit',{transferId:'in'});assert.equal(entered,true);
 await assert.rejects(session.call('setView',{}),/busy/);session.disconnect();resume();await assert.rejects(commit,/revoked/);assert.equal(applied,false);
});
