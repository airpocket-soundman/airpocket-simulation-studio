# Product direction for agent-operated open-source CAE

[日本語](../product-direction.md)

Date: 2026-10-14. This is product direction and proposed requirements, not a declaration of implemented capabilities. See the analysis guide and progress data for released scope.

## Highest-priority product principle (confirmed 2026-10-14)

The primary differentiator is that the user's own LLM can freely compose all application functions through a specialist SKILL to perform analysis and design iteration. The product does not assume a proprietary AI or an AI subscription operated by this application. Users choose their LLM, contract and execution environment; the application supplies shared APIs, MCP, specialist skills, validation and traceable results.

Full API/MCP coverage, continuous specialist-SKILL development and a pipeline delivering intermediate results to the LLM have highest priority. Expose preparation, mesh quality, iterations/residuals, completed time steps and provisional measurements with job IDs/input revisions, compact summaries and detailed artifact references. Declare solver limitations when intermediate fields are unavailable. Observation and preparation of subsequent settings must not mutate a running snapshot.

New GUI features include semantic APIs, MCP operations, observable state/diagnostics, SKILL guidance and verification scenarios in the same work item. Skills teach supported scope, units, physical assumptions, repair and provisional/final distinctions without silently changing models or engines. Acceptance measures API coverage, MCP-only task completion, intermediate observation/reconfiguration and reproducible SKILL-driven examples.

## Near-term publication milestone (2026-10-15)

Complete existing inputs/outputs and agent operation before adding physics disciplines. Prioritize publication recovery, inputs/diagnostics, intermediate observations, saved final results/comparison and reproducible views/image/video exports. Synchronize distributed Skills, machine-readable operation contracts and success/repair examples with each stage. Publication requires an end-to-end workflow in the ordinary browser with the user's own LLM and no computer use.

Do not require all intermediate fields; explicitly declare retrieval capabilities, units, revisions, provisional status and limits. Keep new CFD, contact, printing/measurement and SolidCraft integration as later plans. Track publication work separately from future extensions. The [roadmap](roadmap.md) defines order and concrete acceptance gates.

## Users and workflow

Target users include designers, developers and learners who want their own LLM agent to help set up CAE, use their local CPU/GPU, and compare design alternatives. The browser provides an installation-free entry point. The basic agent connection is an on-demand temporary local connector script. Additional-installation-free reach, public HTTPS connectivity and setup without an existing runtime still require real-environment validation. Native execution requires installation. Data shared with an external LLM may leave the device even when computation is local.

The user supplies geometry and an engineering question. The agent asks for missing physical information, proposes materials, supports, loads, mesh and solver, records assumptions, validates inputs, prepares runtime modules, runs locally, checks convergence and limitations, and feeds results into a revised CAD design.

## Shared API and MCP

Browser UI and MCP should use shared input models, validation, execution and result contracts. APIs should expose solver capabilities and versions, physics, elements, material laws, conditions, coupling, units, valid ranges and CPU/GPU availability. They should also support STEP ingestion, region selection, setup inspection, resource preparation, execution, progress, cancellation and result comparison.

Diagnostics need stable codes, severity, affected objects, evidence, repair options and whether user intent must be confirmed. Automatically adding a constraint does not establish that it represents the real support. Proposed settings retain their source, references and versions, justification, assumptions, verification state and valid range. Missing essential physical inputs block quantitative evaluation; explicitly assumed exploratory runs remain provisional in saved results. LLM confidence is not material evidence.

Separate candidate, implemented and validated solver adapters. Keep common and solver-specific settings distinct. Report unsupported conditions during solver changes and never silently substitute another engine.

## Beginner workflows and sessions

Provide goal-oriented workflows for strength, temperature and resonance questions, including necessary questions, supported scope, initial mesh, refinement criteria and interpretation. Distinguish valid inputs, convergence and physical accuracy.

Default MCP operates on saved local JSON. The optional local connector implements permitted live-browser inspection, edits, execution/cancellation and result retrieval through shared APIs. Public HTTPS connectivity and complete workflow verification remain pending; distinguish implementation from verified public scope. See [operation specifications](automation.md) for current operations. The preferred transport is an agent-launched temporary local script or portable executable serving MCP/CLI and browser communication. Keep commands and large results local without requiring an external relay, manual installation, administrator access, a permanent service or desktop interaction. Agent execution/registration and browser permissions remain environment-dependent.

Prefer a version-pinned, hash-verified minimal script using an available runtime, with a portable executable fallback remaining a candidate, not a delivered runtime-free product. Cache downloads. Bind to loopback, authenticate sessions, check Origins and define shutdown/disconnect/idle behavior. Also evaluate serving the app and API from the same temporary localhost origin, comparing it with public HTTPS-to-localhost connectivity on actual browsers. Do not bypass browser or agent permissions. Existing uv ephemeral execution is an option, not a runtime-free solution. Extensions require installation and central relays add operational/transfer costs, so neither is the default. Define authorization, sharing, expiry, disconnect/reconnect and browser-close behavior. Freeze run inputs and reject stale results.

## Modular WASM and native execution

The product direction is to share core modules across browser WASM and native local builds. Modules cover model/units/provenance/diagnostics, CAD and mesh contracts, solver adapters, results/comparison, jobs and API semantics. Storage, library bindings, Worker/process execution, networking, rendering and CLI/MCP integration are environment-specific.

Not every solver must support both targets. Expose target-specific capabilities. Match schemas and diagnostics where supported and compare numerical outputs with tolerances and physical balances, without requiring bitwise equality. Running WASM through Node is not a native machine-code solver build.

Load the base UI first and acquire CAD, meshing, individual solvers and advanced output modules when needed. Keep capability metadata small and available before runtime acquisition. Resolve dependencies, verify hashes, cache by content/version, prefetch when requirements become known, and report download, initialization, meshing and solve progress separately. Support preparation for offline use and cache inspection/deletion; browser eviction remains possible. Retain Workers during iteration and terminate unused ones to release memory.

Distributed WASM is already built from source, but the browser still compiles it for the device and initializes instances. Compiler-cache reuse is not guaranteed. Measure compressed transfer size, cold/warm preparation, meshing, solve time and peak memory on specified devices and browsers. Startup targets are proposals, not measured guarantees.

Rust is a candidate for shared validation, units, diagnostics and new numerical code. Keep the existing JavaScript UI and useful C/C++ libraries. A full rewrite is undecided; prototype a small shared module and assess size, initialization, interoperability and maintainability. Rust alone does not remove browser compilation or guarantee smaller downloads.

## CAD feedback and open-source publication

Use SolidCraft for parametric design and STEP exchange. Proposed integration metadata includes design identity/revision, hashes, parameter changes, parts/placements and named regions with matching evidence. Initially use geometric reconciliation and explicit reselection. Persistent design-face references require validation; do not rely on face indices. Revalidate conditions and regenerate the mesh after design changes. Save design/input/solver/module/mesh identities and convergence with results, and distinguish geometry changes from analysis-setting changes.

Compare competitors by whether an agent can turn a beginner's intent into a valid analysis and a design improvement. Publish reproducible examples, references and errors, supported scope, fixed releases, build instructions, licenses and contribution guidance. Test counts are not accuracy evidence. See the [competitive comparison](competitive-landscape.md).

## Implementation and acceptance

Follow the roadmap's publication order 0–5: recover deployment and candidate/artifact/progress revision matching; complete existing inputs/capabilities/units/evidence/diagnostics; finish shared jobs/intermediate observations/cancellation/cleanup/ordinary-browser connection; align final-result retrieval/save/restore/comparison/remeasurement; restore views and provide reproducible exports or verified alternatives; synchronize distributed Skill/contracts/success and repair examples with every change and verify the MCP-only loop on the public environment.

On-demand modules, performance and shared-core work support that workflow as needed. SolidCraft integration is subsequent P5 work, not a publication gate. Its first integrated example is a bracket with three thickness alternatives, recording support/load/material questions, assumptions, design revisions, mesh, convergence and results. Verify units, unsupported materials, insufficient constraints, unresolved regions, download failures, disconnects and cancellation while preserving prior data. Test browser CPU/GPU and MCP paths separately.

The temporary local transport is decided; environment-specific permissions/setup, installation-free reach, schemas/versioning, module boundaries, cache/Worker policies, performance limits, Rust migration scope and CAD identity exchange still need decisions or validation. New solver introductions follow the roadmap after publication work.
