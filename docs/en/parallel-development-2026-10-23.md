# Four parallel implementation tracks (2026-10-23)

[日本語](../parallel-development-2026-10-23.md)

The user explicitly authorized parallel work. Separate owners/worktrees implemented orders 54, 63, 64 and 65, followed by independent cross-review and counterexample repairs. The primary checkout and other owners' work were preserved. This follows PR180/181; it does not complete parent features or publication.

| Order | Delivered slice | Remaining |
|---|---|---|
| 54 AGENTACP1 | [Bounded text sessions](agent-acp-session.md): stdio prompts, cancel, timeout and owned-child exit | Actual Codex ACP entry/authentication, GUI, MCP delegation |
| 63 PRINT2 | [Dataset import](printed-measurement-dataset.md): explicit units, original SHA, specimen separation, engineering curves | Measurements, calibration, identification, GUI |
| 64 CFDPORT1 | [Opening confirmation](fluid-domains.md): mesh version, explicit outward normal/interior point to cap contract | General local caps/OCC wires, GUI, solver |
| 65 CFDMESH1 | [Limited Tet4 conversion](channel-layer-tet4.md): shared nodes, positive volume, incidence and wall tags | General Gmsh layers, flow, y+, UI |

Cross-review repaired PRINT2 unit coercion and subnormal gauge lengths producing infinite strain; Tet4 wrong units, absolute minimum-height tolerance and capacity override; ACP close races, late cancellation text, outgoing backpressure, post-failure stdout retention and same-chunk response/notification ordering.

Integrated focused suite: 132 passed, zero failures/skips; ten declaration files type-checked. Three domain modules are registered and layer checks passed. Owner evidence describes their original submitted bases separately from the integrated run. [ACP integration evidence](../evidence/2026-10-23-opencode-54-agentacp1.json), [PRINT2 repairs](../evidence/2026-10-23-print2-audit-fixes.json), [Tet4 repairs](../evidence/2026-10-23-opencode-65-independent-review-fix.json).

The limited reference has 7 cells, 32 nodes, 42 positive-volume Tet4, 20mm³ total volume and two 2mm² wall areas. These are geometric references, not measured or general CFD accuracy. Full CI/build/publication are separate gates. The previous Windows V8 fatal is not considered fixed. Parent progress states and counts are unchanged.
