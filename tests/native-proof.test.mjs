import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Set AIRPOCKET_NATIVE_PROOF to a built host executable to run the native gate.
// A .mjs may be supplied explicitly for WASM-only development validation; this
// checks the CLI mathematics but does not prove host-native execution.
const binary=process.env.AIRPOCKET_NATIVE_PROOF;
const emulated=binary&&/\.(?:mjs|cjs)$/.test(binary);
const run=input=>spawnSync(emulated?process.execPath:binary,emulated?[binary]:[],{input,encoding:'utf8',windowsHide:true,timeout:30000});
test(`${emulated?'WASM development check':'host native proof'}: axial displacement, residual and force balance`, {skip:!binary},()=>{
  for(const [young,load] of [[1e9,100],[2e9,200],[1e9,-100],[1e9,0]]) {
    const result=run(`airpocket-native-proof-v1 ${young} ${load}\n`);
    assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
    const output=JSON.parse(result.stdout),expected=load*.04/(young*.0001);
    assert.equal(output.schemaVersion,1);assert.equal(output.engine,'mfem-native');assert.equal(output.mfemVersion,41000);
    assert.equal(output.runtime,emulated?'wasm-development-check':'host-native');
    assert.ok(Math.abs(output.expectedDisplacementM-expected)<1e-15);
    assert.ok(Math.abs(output.topDisplacementM-expected)<1e-10+Math.abs(expected)*1e-7);
    assert.ok(output.maxDisplacementErrorM<1e-10+Math.abs(expected)*1e-7);
    assert.ok(Math.abs(output.reactionN+load)<1e-8+Math.abs(load)*1e-7);
    assert.ok(output.forceBalanceErrorN<1e-8+Math.abs(load)*1e-7);
    assert.ok(output.verifiedResidual<2e-8);
  }
});
test(`${emulated?'WASM development check':'host native proof'} rejects malformed protocol and material`, {skip:!binary},()=>{
  for(const input of ['bad 1e9 100','airpocket-native-proof-v1 -1 100','airpocket-native-proof-v1 1e9','airpocket-native-proof-v1 1e9 100 extra']) {
    const result=run(input);assert.ifError(result.error);assert.notEqual(result.status,0);assert.equal(result.stdout,'');
  }
});
