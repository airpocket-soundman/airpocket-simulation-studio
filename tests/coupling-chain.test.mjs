import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCouplingChain,COUPLING_TRANSFERS} from '../src/coupling-chain.js';

const rev=c=>'sha256:'+c.repeat(64);
const chain=()=>[
 {id:'heat',physics:'thermal',revision:rev('a'),sources:[]},
 {id:'stress',physics:'structural',revision:rev('b'),sources:[{from:'heat',kind:'temperature',revision:rev('a')}]},
 {id:'modal',physics:'structural',revision:rev('c')},
 {id:'sound',physics:'acoustic',revision:rev('d'),sources:[{from:'modal',kind:'vibration',revision:rev('c')}]},
];
const codes=r=>r.diagnostics.map(d=>d.code);

test('current one-way chain is ordered and has no stale stage',()=>{
 const r=inspectCouplingChain(chain());
 assert.equal(r.valid,true);assert.equal(r.current,true);assert.deepEqual(r.stale,[]);
 assert.ok(r.order.indexOf('heat')<r.order.indexOf('stress'));assert.ok(r.order.indexOf('modal')<r.order.indexOf('sound'));
});

test('changed producer revision marks consumer stale and propagates downstream',()=>{
 const c=chain();c[0].revision=rev('e');
 c.push({id:'stress-sound',physics:'acoustic',revision:rev('f'),sources:[{from:'stress',kind:'vibration',revision:rev('b')}]});
 const r=inspectCouplingChain(c);
 assert.equal(r.current,false);
 assert.deepEqual(r.stale.map(s=>[s.stage,s.reason]),[['stress','source-revision-changed'],['stress-sound','upstream-stale']]);
 assert.equal(r.stale[0].recorded,rev('a'));assert.equal(r.stale[0].current,rev('e'));
 assert.ok(!r.stale.some(s=>s.stage==='sound'));
});

test('transfer kinds must match producer and consumer physics',()=>{
 const c=chain();c[3].sources[0].kind='temperature';
 assert.deepEqual(codes(inspectCouplingChain(c)),['COUPLING_TRANSFER_UNSUPPORTED']);
 const d=chain();d[1].sources[0].kind='__proto__';
 assert.deepEqual(codes(inspectCouplingChain(d)),['COUPLING_TRANSFER_UNSUPPORTED']);
 assert.ok(Object.isFrozen(COUPLING_TRANSFERS));
});

test('cycles and self references are rejected, not iterated',()=>{
 const c=[{id:'a',physics:'thermal',revision:rev('a'),sources:[{from:'b',kind:'heatFlux',revision:rev('b')}]},{id:'b',physics:'thermal',revision:rev('b'),sources:[{from:'a',kind:'heatFlux',revision:rev('a')}]}];
 const r=inspectCouplingChain(c);assert.equal(r.valid,false);assert.deepEqual(codes(r),['COUPLING_CYCLE','COUPLING_CYCLE']);
 assert.deepEqual(codes(inspectCouplingChain([{id:'a',physics:'thermal',revision:rev('a'),sources:[{from:'a',kind:'heatFlux',revision:rev('a')}]}])),['COUPLING_CYCLE']);
});

test('invalid descriptions are rejected with diagnostics',()=>{
 assert.deepEqual(codes(inspectCouplingChain([])),['COUPLING_CHAIN_INVALID']);
 const c=chain();c.push({...c[0]});assert.ok(codes(inspectCouplingChain(c)).includes('COUPLING_STAGE_DUPLICATE'));
 const d=chain();d[1].revision='abc';d[1].sources[0].from='missing';
 assert.deepEqual(codes(inspectCouplingChain(d)),['COUPLING_REVISION_INVALID','COUPLING_SOURCE_UNKNOWN']);
 const e=chain();e[2].physics='magnetic';e.splice(3,1);assert.deepEqual(codes(inspectCouplingChain(e)),['COUPLING_STAGE_INVALID']);
});
