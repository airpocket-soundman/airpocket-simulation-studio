import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const evidence=JSON.parse(await readFile(new URL('../docs/evidence/2026-10-29-opencode-97-p5.json',import.meta.url),'utf8'));

test('P5 evidence: one synthetic design loop with per-variant mesh sweeps, a recorded decision and a round-2 result',async()=>{
 assert.equal(evidence.transport,'real MCP stdio (scripts/studio-mcp.mjs)');assert.match(evidence.synthetic.geometry,/synthetic/);
 assert.equal(evidence.scriptHash,'sha256:'+createHash('sha256').update(await readFile(new URL('../scripts/experimental/p5-bracket-design-loop.mjs',import.meta.url))).digest('hex'));
 for(const tool of ['studio_create_builtin_project','studio_edit_project','studio_preflight_project','studio_start_analysis','studio_compare_cases'])assert.ok(evidence.toolsUsed.includes(tool),tool);
 assert.deepEqual(evidence.table.map(r=>[r.round,r.thicknessMm]),[[1,2],[1,3],[1,4],[2,evidence.decision.nextThicknessMm]]);
 assert.equal(new Set(evidence.table.map(r=>r.inputRevision)).size,4);
 for(const row of evidence.table){
  assert.equal(row.preflight.allowed,true);assert.deepEqual(row.solves.map(s=>s.meshSizeMm),evidence.synthetic.meshSizesMm);
  for(const s of row.solves){assert.equal(s.state,'succeeded');assert.equal(s.provisional,true);}
  assert.ok(row.solves.at(-1).elementCount>row.solves[0].elementCount);
  // Tet4 still stiffer than beam theory at the finest size; convergence is reported, not assumed.
  assert.ok(row.displacementRatioToBeam<1);assert.equal(row.convergence.converged,row.convergence.change<row.convergence.threshold);
 }
 const d=evidence.decision;assert.ok(!evidence.table.slice(0,3).some(r=>r.thicknessMm===d.nextThicknessMm));
 assert.ok(d.nextThicknessMm>=d.exactThicknessMm&&d.nextThicknessMm-d.exactThicknessMm<.1+1e-9);
 assert.equal(d.outcome.meetsTarget,d.outcome.finestMaxDisplacementMm<=1);
 assert.deepEqual(d.unconvergedInputs,evidence.table.slice(0,3).filter(r=>!r.convergence.converged).map(r=>r.thicknessMm));
 const c=evidence.comparison.result.comparison;assert.equal(c.comparable,true);assert.equal(c.deltas.length,3);
 assert.ok(evidence.missingApi.some(x=>/fused/i.test(x)));
});
