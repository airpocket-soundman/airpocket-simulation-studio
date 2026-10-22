import assert from 'node:assert/strict';
// Explicit public tool-name baseline. Compare names, not a brittle duplicated count.
const savedTools=[
  "studio_analyze",
  "studio_apply_cad_update",
  "studio_archive_results",
  "studio_assess_result",
  "studio_assessment",
  "studio_browser_contracts",
  "studio_cancel_job",
  "studio_capabilities",
  "studio_compare_cases",
  "studio_create_builtin_project",
  "studio_diagnose_execution",
  "studio_edit_project",
  "studio_import_print",
  "studio_import_project",
  "studio_increment_curve",
  "studio_inspect_case",
  "studio_inspect_print",
  "studio_inspect_project",
  "studio_job_artifact",
  "studio_job_artifacts",
  "studio_job_events",
  "studio_job_status",
  "studio_material_catalog",
  "studio_preflight_mesh_boundaries",
  "studio_preflight_project",
  "studio_preview_cad_update",
  "studio_preview_edit",
  "studio_probe",
  "studio_progress",
  "studio_release_job",
  "studio_restore_case_input",
  "studio_restored_jobs",
  "studio_start_analysis",
  "studio_validate_case_bundle",
  "studio_validate_cases",
  "studio_verify_measurements"
];
const browserTools=['studio_browser_sessions','studio_browser_call'];
export function assertMcpTools(tools,{browser=false,minimal=false}={}){
 const names=tools.map(t=>t.name);assert.equal(new Set(names).size,names.length,'Tool names must be unique');
 const expected=minimal?['studio_browser_contracts',...browserTools]:[...savedTools,...(browser?browserTools:[])];
 assert.deepEqual([...names].sort(),[...expected].sort(),'Public MCP tool-name contract');
}
