import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeIdentity,validateRuntimeIdentity} from '../src/runtime-identity.js';
const sha='sha256:'+'a'.repeat(64),build={status:'available',version:'0.43.0',revision:'b'.repeat(40),dirty:false,sourceFingerprint:sha};
test('runtime identities preserve exact declared/observed evidence and legacy absence, with detached values',()=>{
 assert.equal(validateRuntimeIdentity(undefined),undefined);assert.throws(()=>validateRuntimeIdentity(undefined,{allowUndefined:false}));
 const identity=createRuntimeIdentity({target:'browser',isolation:'web-worker',build,requestedMethod:'wasm-pcg',actualEngine:'Airpocket Heat Tet4 / WASM CPU',assets:[{role:'kernel',bytes:20,sha256:sha,status:'observed'},{role:'gmsh',bytes:30,sha256:sha,status:'declared'}]});
 assert.equal(identity.engine.requestedMethod,'wasm-pcg');assert.equal(identity.assets[1].status,'declared');identity.build.version='edited';assert.equal(build.version,'0.43.0');const clone=validateRuntimeIdentity(identity);clone.assets[0].bytes=999;assert.equal(identity.assets[0].bytes,20);
 assert.deepEqual(createRuntimeIdentity({target:'node',isolation:'process'}).build,{status:'unavailable'});
});
test('runtime schema rejects malformed, excessive and accessor/nonJSON metadata without executing getters',()=>{
 const identity=createRuntimeIdentity({target:'node',isolation:'worker-thread',build});
 for(const change of [{schemaVersion:2},{extra:1},{target:'browser'},{isolation:'none'},{build:{status:'unavailable',version:'current'}},{build:{...build,dirty:'false'}},{build:{...build,sourceFingerprint:'bad'}},{build:{...build,revision:'main'}},{engine:{requestedMethod:3,actualEngine:null}},{engine:{requestedMethod:null,actualEngine:'x'.repeat(201)}},{assets:[{role:'other',bytes:1,sha256:sha,status:'observed'}]},{assets:[{role:'kernel',bytes:NaN,sha256:sha,status:'observed'}]},{assets:Array(17).fill({role:'kernel',bytes:1,sha256:sha,status:'observed'})}])assert.throws(()=>validateRuntimeIdentity({...identity,...change}));
 let called=0;Object.defineProperty(identity.build,'status',{enumerable:true,get(){called++;throw Error('getter');}});assert.throws(()=>validateRuntimeIdentity(identity));assert.equal(called,0);
 const sparse=Array(1);assert.throws(()=>createRuntimeIdentity({target:'node',isolation:'process',assets:sparse}));
});
