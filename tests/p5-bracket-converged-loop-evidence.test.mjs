import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const evidence=JSON.parse(await readFile(new URL('../docs/evidence/2026-10-29-opencode-98-p5.json',import.meta.url),'utf8'));
const hash=async path=>'sha256:'+createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex');

test('P5 evidence: every variant converges under Tet10 on the MCP meshes and the selection follows the recorded rule',async()=>{
 assert.equal(evidence.scriptHash,await hash('scripts/experimental/p5-bracket-converged-loop.mjs'));
 assert.equal(evidence.tet10Hash,await hash('src/tet10-elastic.js'));
 for(const tool of ['studio_create_builtin_project','studio_edit_project','studio_preflight_project','studio_start_analysis'])assert.ok(evidence.toolsUsed.includes(tool),tool);
 assert.match(evidence.diagnosis.cause,/locking/);
 const {table,decision}=evidence;assert.deepEqual(table.map(r=>[r.round,r.thicknessMm]),[[1,2],[1,3],[1,4],[2,decision.nextThicknessMm]]);
 assert.equal(new Set(table.map(r=>r.inputRevision)).size,4);
 for(const row of table){
  assert.equal(row.preflight.allowed,true);assert.deepEqual(row.solves.map(s=>s.meshSizeMm),evidence.synthetic.meshSizesMm);
  for(const s of row.solves){assert.equal(s.state,'succeeded');assert.equal(s.provisional,true);assert.ok(s.tet10.pcgResidual<1e-10);
   // Uniform tip traction acts on exactly the full tip face; Tet10 is more flexible than locked Tet4 on the same mesh.
   assert.ok(Math.abs(s.tet10.loadedAreaMm2-20*row.thicknessMm)<1e-6);assert.ok(s.tet10.maxDisplacementMm>s.tet4.maxDisplacementMm);}
  assert.equal(row.convergence.threshold,.05);assert.equal(row.convergence.converged,true);assert.ok(row.convergence.change<row.convergence.tet4ChangeSameMeshes);
  // Converged answer sits close to Timoshenko beam theory (a fully clamped 3D root is slightly stiffer).
  assert.ok(row.displacementRatioToTimoshenko>.9&&row.displacementRatioToTimoshenko<1.05,`${row.thicknessMm} ${row.displacementRatioToTimoshenko}`);
 }
 assert.deepEqual(decision.unconvergedInputs,[]);assert.ok(!table.slice(0,3).some(r=>r.thicknessMm===decision.nextThicknessMm));
 assert.ok(decision.nextThicknessMm>=decision.exactThicknessMm&&decision.nextThicknessMm-decision.exactThicknessMm<.1+1e-9);
 assert.equal(decision.outcome.meetsTarget,decision.outcome.finestMaxDisplacementMm<=1);
 assert.equal(decision.selection.thicknessMm,decision.outcome.converged&&decision.outcome.meetsTarget?decision.nextThicknessMm:null);
});
