import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {validateProgress} from '../src/progress.js';
const current=()=>JSON.parse(readFileSync(new URL('../src/progress.json',import.meta.url)));
test('entire roadmap has unique IDs, valid dependencies and evidence',()=>{assert.ok(validateProgress(current()).tasks.length>40);});
test('reject circular or missing dependencies and false release',()=>{const p=current();p.tasks[0].depends=[p.tasks[1].id];p.tasks[1].depends=[p.tasks[0].id];assert.throws(()=>validateProgress(p));const q=current();q.tasks[0].depends=['missing'];assert.throws(()=>validateProgress(q));const r=current();delete r.tasks[0].evidence;assert.throws(()=>validateProgress(r));});
