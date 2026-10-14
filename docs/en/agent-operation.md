# LLM-first API and MCP operation

[日本語](../agent-operation.md)

Date: 2026-10-14. Target requirements, not current implementation claims. User-owned agents should operate all user-facing functions, observe intermediate state and efficiently revise conditions through shared GUI/API operations.

## Highest-priority product principle (confirmed 2026-10-14)

The primary differentiator is that the user's own LLM can freely compose all application functions through a specialist SKILL to perform analysis and design iteration. The product does not assume a proprietary AI or an AI subscription operated by this application. Users choose their LLM, contract and execution environment; the application supplies shared APIs, MCP, specialist skills, validation and traceable results.

Full API/MCP coverage, continuous specialist-SKILL development and a pipeline delivering intermediate results to the LLM have highest priority. Expose preparation, mesh quality, iterations/residuals, completed time steps and provisional measurements with job IDs/input revisions, compact summaries and detailed artifact references. Declare solver limitations when intermediate fields are unavailable. Observation and preparation of subsequent settings must not mutate a running snapshot.

New GUI features include semantic APIs, MCP operations, observable state/diagnostics, SKILL guidance and verification scenarios in the same work item. Skills teach supported scope, units, physical assumptions, repair and provisional/final distinctions without silently changing models or engines. Acceptance measures API coverage, MCP-only task completion, intermediate observation/reconfiguration and reproducible SKILL-driven examples.

## Levels

1. Selected callable operations.
2. Complete geometry/setup/mesh/solve/results workflow.
3. Capabilities, state, missing inputs and structured diagnostics.
4. Intermediate observations, jobs, validated incremental edits and comparisons.
5. All user-facing functions including viewer/export/save, provenance and CAD iteration.

Level 5 is the product goal. Assess competitors through equal scenarios rather than tool counts or mere API availability.

## Shared operations

Expose import, semantic region selection, materials, conditions, meshing, jobs, comparison, probes, time, camera, layers, animation export and persistence. GUI gestures map to semantic operations; screen-coordinate clicking is not required. Maintain GUI/common-operation/MCP coverage mapping. Validate storage and communication permissions separately.

## Intermediate data and jobs

Report download/initialization, mesh quality and boundary errors, iterations/residual trends, completed transient steps and available provisional observations. Only return field snapshots supported by the solver, with input revision, job ID, step/time and convergence status. Never present unconverged output as final. Expose adapter limitations.

Return job IDs promptly. Provide bounded events or revision-based polling, reconnectable status and duplicate-request protection. Keep large fields in artifacts; return summaries, probes and regional statistics to the LLM by default.

## Fast revision

Validate changes before atomically applying them with expected-revision guards and undo history. Track dependencies between geometry, regions, mesh, materials, conditions, assembled matrices and preconditioners. Reuse only mathematically valid caches matching inputs and versions. Nonlinear history and initial state remain explicit inputs.

Freeze active run inputs. Prepare changes for a new run, cancel when appropriate, and allow mid-run edits/restarts only when explicitly supported. Report reuse and invalidation before execution.

## Agent-friendly contracts and validation

Provide typed units/ranges/enumerations, available actions and reasons, both composable and workflow operations, stable semantic identities, documented defaults, provenance/assumptions, repair guidance and separate summary/detail retrieval. Tie numerical fields and media to result revisions.

Verify a bracket workflow entirely through MCP: clarification, setup, solve, failure repair, revision, comparison and video export. Test GUI consistency, cancellation, disconnects, duplicate requests, stale revisions and invalid inputs. Measure coverage, completion, manual interventions, calls/payload, repair success, cold/warm latency, cache reuse and reproducibility.
