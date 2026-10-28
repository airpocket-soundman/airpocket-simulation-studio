import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const evidence=JSON.parse(await readFile(new URL('../docs/evidence/2026-10-29-opencode-92-p5.json',import.meta.url),'utf8'));

test('P5 evidence: three synthetic thickness variants solved and compared only through MCP',async()=>{
 assert.equal(evidence.transport,'real MCP stdio (scripts/studio-mcp.mjs)');assert.match(evidence.synthetic.geometry,/synthetic/);
 assert.equal(evidence.scriptHash,'sha256:'+createHash('sha256').update(await readFile(new URL('../scripts/experimental/p5-bracket-thickness-sweep.mjs',import.meta.url))).digest('hex'));
 for(const tool of ['studio_create_builtin_project','studio_edit_project','studio_preflight_project','studio_start_analysis','studio_compare_cases'])assert.ok(evidence.toolsUsed.includes(tool),tool);
 assert.deepEqual(evidence.table.map(r=>r.thicknessMm),[2,3,4]);
 assert.equal(new Set(evidence.table.map(r=>r.inputRevision)).size,3);
 for(const row of evidence.table){assert.equal(row.state,'succeeded');assert.equal(row.provisional,true);assert.equal(row.preflight.allowed,true);assert.ok(row.maxDisplacementMm>0);}
 // Thicker plate is stiffer, but Tet4 at one mesh size is far stiffer than beam theory: not a converged design comparison.
 assert.ok(evidence.table[0].maxDisplacementMm>evidence.table[1].maxDisplacementMm&&evidence.table[1].maxDisplacementMm>evidence.table[2].maxDisplacementMm);
 assert.ok(evidence.table.every(r=>r.displacementRatioToBeam<1));
 const c=evidence.comparison.result.comparison;assert.equal(c.comparable,true);assert.equal(c.deltas.length,2);
 assert.ok(evidence.unverified.some(x=>/convergence/i.test(x)));
});
