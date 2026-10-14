import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyProofOutput,verifyNativeWasmPair,verifyHostExecutable,runProof,proofFixtures,invalidProofInputs} from '../scripts/check-native-proof.mjs';
function output(runtime='host-native',young=1e9,load=100){return {schemaVersion:1,engine:'mfem-native',runtime,mfemVersion:41000,youngPa:young,loadN:load,expectedDisplacementM:load*.04/(young*.0001),topDisplacementM:load*.04/(young*.0001),maxDisplacementErrorM:0,reactionN:-load,forceBalanceErrorN:0,verifiedResidual:0};}
test('native proof contract rejects runtime substitution, version drift, missing fields and nonphysical evidence',()=>{
 const options={runtime:'host-native',young:1e9,load:100},valid=output();assert.equal(verifyProofOutput(valid,options),valid);
 for(const patch of [{runtime:'wasm-development-check'},{engine:'javascript-fallback'},{mfemVersion:40900},{schemaVersion:2},{youngPa:2e9},{loadN:-100},{topDisplacementM:0},{reactionN:100},{maxDisplacementErrorM:-1},{forceBalanceErrorN:-1},{verifiedResidual:2e-8},{verifiedResidual:NaN},{topDisplacementM:Infinity},{extra:'ignored'}])assert.throws(()=>verifyProofOutput({...valid,...patch},options),JSON.stringify(patch));
 const missing={...valid};delete missing.reactionN;assert.throws(()=>verifyProofOutput(missing,options));
});
test('same-source parity checks positive, negative and zero loading and refuses WASM as host evidence',()=>{
 for(const fixture of proofFixtures){const [young,load]=fixture;verifyNativeWasmPair(output('host-native',young,load),output('wasm-development-check',young,load),fixture);}
 assert.throws(()=>verifyNativeWasmPair(output('wasm-development-check'),output('wasm-development-check'),[1e9,100]));
 assert.throws(()=>runProof('fake.cjs','airpocket-native-proof-v1 1e9 100'));
 assert.throws(()=>runProof('fake.wasm','airpocket-native-proof-v1 1e9 100'));
 verifyHostExecutable(Buffer.from('7f454c46','hex'),'linux');verifyHostExecutable(Buffer.from('4d5a9000','hex'),'win32');
 assert.throws(()=>verifyHostExecutable(Buffer.from('#!/bin/sh'),'linux'));assert.throws(()=>verifyHostExecutable(Buffer.from('0061736d','hex'),'linux'));assert.throws(()=>verifyHostExecutable(Buffer.from('7f454c46','hex'),'win32'));
});
const host=process.env.AIRPOCKET_NATIVE_PROOF,wasm=process.env.AIRPOCKET_NATIVE_PROOF_WASM;
test('actual host executable and WASM CLI agree on mathematics and malformed-input diagnostics',{skip:!host||!wasm},()=>{
 for(const fixture of proofFixtures){const [young,load]=fixture,input=`airpocket-native-proof-v1 ${young} ${load}\n`,native=runProof(host,input),emulated=runProof(wasm,input,{wasm:true});for(const r of [native,emulated]){assert.ifError(r.error);assert.equal(r.status,0,r.stderr);}verifyNativeWasmPair(JSON.parse(native.stdout),JSON.parse(emulated.stdout),fixture);}
 for(const [binary,isWasm] of [[host,false],[wasm,true]])for(const input of invalidProofInputs){const r=runProof(binary,input,{wasm:isWasm});assert.ifError(r.error);assert.notEqual(r.status,0);assert.equal(r.stdout,'');assert.match(r.stderr,/Expected airpocket-native-proof-v1/);}
});
