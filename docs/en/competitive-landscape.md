# Competitors for agent-operated CAE

[日本語](../competitive-landscape.md)

Research date: 2026-10-14. This compares public primary-source documentation, not measured performance or accuracy. Unknown features are not treated as unsupported. Airpocket goals are requirements, not released capabilities.

## Capability matrix

Y: documented support. P: partial or conditional. N: outside the confirmed offering. ?: not confirmed.

| Criterion | Airpocket now | Goal | SimScale | PhysBox | mcp-calculix | FreeCAD MCP TESSA | FEAScript | Stabileo |
|---|---|---|---|---|---|---|---|---|
| User-owned compute | Y | Y | N | Y | Y | Y | Y | Y |
| Installation-free browser use | Y | Y | Y | Y | N | N | P | Y |
| Own agent through APIs | P | Y | Y | Y | Y | Y | P | ? |
| MCP interface | Y | Y | ? | Y | Y | Y | ? | ? |
| Agent operates live browser analysis | N | Y | ? | Y | P | N | ? | ? |
| No additional agent connector installation | N | Y | P | N | N | N | ? | ? |
| Multiple analysis engines | Y | Y | Y | Y | P | P | P | ? |
| Independent solver choice/comparison for one problem | P | Y | ? | ? | N | P | ? | ? |
| Agent-readable preflight and structured information | P | Y | P | P | Y | P | ? | ? |
| Consistent sources/assumptions/unverified-setting records | P | Y | ? | ? | P | ? | ? | ? |
| CAD modification and analysis loop | P | Y | Y | P | P | P | ? | P |
| CAE core distributed as WASM and native builds | N | Y | ? | ? | N | N | N | ? |
| Open-source policy permitting redistribution | Y | Y | N | N | Y | Y | Y | P |

Airpocket's current MCP uses saved JSON. Independent engine comparison is limited to Airpocket/MFEM linear structure. Material sources are partial provenance support. Node-hosted WASM is distinct from native solver builds. PhysBox engines across different domains are not independent solvers for the same problem. mcp-calculix's result App is distinct from live browser solving; Gmsh is a mesher. FreeCAD export support is distinct from a validated end-to-end solve. FEAScript's CPU/WebGPU and linear methods are distinct from independent CAE engines, and Node JavaScript is not a native machine-code build. Stabileo's OSS claim was checked, but its full license was not audited here; its model loop is primarily frame editing/recalculation.

## Closest competitors

- [SimScale Engineering AI](https://www.simscale.com/product/engineering-ai/) and [Simulation API](https://www.simscale.com/technology/simulation-api/): commercial cloud simulation with agent setup/postprocessing, external API workflows and custom methods. [Onshape integration](https://www.simscale.com/blog/engineering-ai-explained/) supports CAD-context operation. Local compute and open source are Airpocket differentiators; API availability does not establish universal MCP support.
- [PhysBox](https://physbox.io/): browser WASM with agent control through a Python companion and local WebSocket relay. Its circuit, rigid-body/mechanism and fabrication workflows resemble the connectivity goal, but MuJoCo collision evaluation is not continuum stress FEA. Its [PPPL license](https://physbox.io/license.html) restricts competing standalone redistribution, so it is classified as restricted source-public software rather than conventional OSS.
- [mcp-calculix](https://github.com/superWorldSavior/mcp-calculix): MIT server with native Gmsh/CalculiX, container/Deno deployment, unit-bearing observations, preflight and reproducible evidence. README lists static, modal, buckling, creep and steady temperature-displacement paths. The [analysis contract](https://github.com/superWorldSavior/mcp-calculix/blob/main/docs/analysis-contracts.md) separates solver observations from engineering approval. Agent-provided loads/materials remain required.
- [sandraschi FreeCAD MCP](https://github.com/sandraschi/freecad-mcp/blob/master/docs/mcp-tools.md): documented CAD, FEM and CFD tools; FreeCAD and local dependencies required. Runtime reliability and license details need further assessment.
- [TESSA FreeCAD MCP](https://github.com/tessalabs-space/freecad-mcp): MIT extension with parameter sweeps, named boundaries and solver handoff/export. Requires FreeCAD/addon/Python. Multi-solver preparation is not evidence of complete execution or condition retention.
- [FEAScript](https://github.com/FEAScript/FEAScript-core) and [Stabileo](https://github.com/lambdaclass/stabileo): local browser computation references; standard MCP and full CAD feedback were not confirmed in the reviewed sources.

Server/extension licenses and bundled solver licenses must be assessed separately. Tool counts do not establish quality or maturity.

## Adjacent products and integrations

[PhysicsX](https://www.physicsx.ai/platform) combines numerical simulation and trained physics AI for enterprise exploration. The reviewed [Ansys Engineering Copilot guide](https://ansyshelp.ansys.com/public/Views/Secured/corp/v261/en/copilot_ug/copilot_ug_intro.html) focuses on learning/support rather than proving autonomous simulation operation. [SolidCraft](https://github.com/bherbruck/solidcraft) and [PartMode](https://github.com/BOMWiki/partmode) are CAD integration/reference candidates, not interchangeable CAE solver offerings.

## Positioning and validation priorities

Differentiate through the combination of own agent, own compute, browser entry, validated solver options, provenance/diagnostics and CAD iteration. No reviewed competitor was confirmed to satisfy every goal, but this does not justify a uniqueness claim. Airpocket still needs live connectivity, common diagnostic contracts, provenance and automatic CAD loops.

Prioritize agent-session connectivity, capabilities/preflight/units/repair guidance, evidence linked to revisions, a SolidCraft bracket loop, and on-demand WASM acquisition with cold/warm measurements. Compare identical bracket geometry/material/load/support cases for setup effort, clarification questions, failures, region retention after edits, reference errors, latency/memory and reproducibility. Record environment differences between cloud and local execution.
