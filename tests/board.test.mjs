import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tasks,stages} from '../src/board-data.js';
test('board has valid stages and resolvable dependencies',()=>{
 const ids=new Set(tasks.map(t=>t.id));assert.equal(ids.size,tasks.length);
 for(const t of tasks){assert.ok(stages.some(s=>s[0]===t.status));for(const dep of t.depends||[])assert.ok(ids.has(dep));if(t.status==='released')assert.ok(t.evidence);}
});
