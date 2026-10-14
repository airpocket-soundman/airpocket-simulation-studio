# Product direction for agent-operated open-source CAE

[日本語](../product-direction.md)

Date: 2026-10-14. This is product direction and proposed requirements, not a declaration of implemented capabilities. See the analysis guide and progress data for released scope.

## Users and workflow

Target users include designers, developers and learners who want their own LLM agent to help set up CAE, use their local CPU/GPU, and compare design alternatives. The browser provides an installation-free entry point. Agent connectivity without additional installation is also a goal; its transport remains undecided. Native execution requires installation. Data shared with an external LLM may leave the device even when computation is local.

The user supplies geometry and an engineering question. The agent asks for missing physical information, proposes materials, supports, loads, mesh and solver, records assumptions, validates inputs, prepares runtime modules, runs locally, checks convergence and limitations, and feeds results into a revised CAD design.

## Shared API and MCP

Browser UI and MCP should use shared input models, validation, execution and result contracts. APIs should expose solver capabilities and versions, physics, elements, material laws, conditions, coupling, units, valid ranges and CPU/GPU availability. They should also support STEP ingestion, region selection, setup inspection, resource preparation, execution, progress, cancellation and result comparison.

Diagnostics need stable codes, severity, affected objects, evidence, repair options and whether user intent must be confirmed. Automatically adding a constraint does not establish that it represents the real support. Proposed settings retain their source, references and versions, justification, assumptions, verification state and valid range. Missing essential physical inputs block quantitative evaluation; explicitly assumed exploratory runs remain provisional in saved results. LLM confidence is not material evidence.

Separate candidate, implemented and validated solver adapters. Keep common and solver-specific settings distinct. Report unsupported conditions during solver changes and never silently substitute another engine.

## Beginner workflows and sessions

Provide goal-oriented workflows for strength, temperature and resonance questions, including necessary questions, supported scope, initial mesh, refinement criteria and interpretation. Distinguish valid inputs, convergence and physical accuracy.

The current MCP works on saved local JSON rather than live browser state. Proposed live sessions expose inspection, edits, run/cancel and results through the shared API. Consider a local companion transport first and a relay transport for installation-free agent access. Define authorization, sharing, expiry, disconnect/reconnect and browser-close behavior. Freeze run inputs and reject stale results.

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

Prioritize capabilities/diagnostics, provenance/preflight, STEP setup APIs, on-demand modules and measurements, live agent sessions, and a SolidCraft linear-structural loop. The first integrated example is a bracket with three thickness alternatives. Record support/load/material questions, assumptions, design revisions, mesh, convergence and results. Verify units, unsupported materials, insufficient constraints, unresolved regions, download failures, disconnects and cancellation while preserving prior data. Test browser CPU/GPU and MCP paths separately.

Transport, schemas/versioning, module boundaries, cache/Worker policies, performance limits, Rust migration scope, CAD identity exchange and additional solver priorities remain undecided.
