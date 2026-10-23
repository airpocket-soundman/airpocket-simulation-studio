# REG2 and input-guidance main-browser follow-up (2026-10-23)

[日本語](../reg2-agentinput-main-iab-2026-10-23.md) / [Fixed-candidate reconciliation](verification-followup-reconciliation-2026-10-23.md)

Root performed the actual main-UI observations at fixed source `35e5b0a`; another agent packaged retained proof. The [aggregate JSON](../evidence/2026-10-23-reg2-agentinput-main-iab.json) records source Git blob/SHA-256 and retained-file bytes/hashes. This was IAB2 with a reduced Chrome155-family user agent, not an independent Chrome-extension run. Screenshots are1280×720. Parent acceptance, all37 unfinished tasks and publication status remain unchanged.

## REG2 blank and explicit end radius

A synthetic gmsh cone STEP/Three display followed the existing `tests/conical-wiring.test.mjs` generation method and was loaded through a QA button calling the public studio API. Actual main controls selected radius10mm, blank end radius, tolerance2mm, Y axial range−10..10mm, start315° and sweep90°, selecting384 triangles and registering100N.

The condition showed radius10mm without an undefined value or an arrow to zero. Reapplying the dimensional region kept the end field blank. A second condition with end radius8mm and tolerance0.3mm showed radius10→8mm in JA and EN. Retained proof includes the [comparison screenshot](../evidence/reg2-agentinput-iab-20261023/reg2-blank-and-explicit-en.jpg) and [DOM text](../evidence/reg2-agentinput-iab-20261023/reg2-observed-text.json). Blank means cylindrical intent, not automatic cone inference.

The saved JSON had593,069 characters. CUA's200k output limit truncated full retrieval and parsing that returned string failed. A subsequent in-DOM JSON.parse returned only condition/source summaries: source kind=step, no end radius on the first condition,8 on the second. Complete saved bytes/hash remain unverified. No solver ran; this UI check does not establish exact CAD matching, mesh accuracy or force conservation.

## AGENTINPUT1 formal MCP and visible focus

The existing `docs/evidence/review46-chrome/valid-warning.json` was loaded normally. Young components1000/2000/3000Pa and two conditions produced the three exact pointers and fallback guidance in JA/EN. Tab→Enter reached the first guide; Enter on all three focused `material-status`, opened parent details and showed an outline in both languages. Proof includes [EN](../evidence/reg2-agentinput-iab-20261023/agentinput-focus-en.jpg), [JA](../evidence/reg2-agentinput-iab-20261023/agentinput-focus-ja.jpg) and [GUI readbacks](../evidence/reg2-agentinput-iab-20261023/gui.json).

Formal stdio MCP paired with inspect-only permission and matched all three diagnostic targets against the GUI. EN/JA before/after revisions were identical in all four reads: `sha256:3879741459419d04e78ac5ee4e323604572f68174812e0ba5838ca1d343ab62d`; both inspectEqual values were true. Retained sanitized full reports are [EN](../evidence/reg2-agentinput-iab-20261023/mcp-report-en.json), [JA](../evidence/reg2-agentinput-iab-20261023/mcp-report-ja.json) and [contracts](../evidence/reg2-agentinput-iab-20261023/mcp-contracts.json).

Changing mesh size to6 cleared stale diagnostics; a fresh check restored three warnings. The existing valid-inrange fixture produced zero unit warnings. See [invalidation readbacks](../evidence/reg2-agentinput-iab-20261023/invalidation.json). This does not complete all-physics preflight or the input-create/solve/intermediate-read Skill loop. JA fallback guidance was Japanese, but focused material-status text still remained English in this observation. No later fix is credited here.

## Reproduction and cleanup

Use the existing cone generation method and review46 fixtures through a QA button calling public `studioApi.loadProject`, then operate existing main `cylinder-*`, `preflight-run`, `preflight-diagnostics` and `material-status` controls. Follow `docs/opencode-review-followups-2026-10-21/46-AGENTINPUT1.md` and `docs/evidence/review46-chrome/replay.md` for valid values and acceptance. No credential-bearing driver or automatic reconnect is retained.

[Cleanup](../evidence/reg2-agentinput-iab-20261023/driver-cleanup.json) confirms the owned stdio child exited and temporary pairing file was removed. GUI disconnected and cleared endpoint/code; the owned tab and server closed. No edits or solver were requested. Root also observed the complete current exterior-fluid explanation in English DOM after i18n fix `115ff39`; no screenshot was retained for that observation.

## Actual-browser follow-up after the locale fix

The earlier Japanese-page English residue remains preserved as a historical observation. Root repeated the actual IAB check at source `17731eb`, including locale fix `111d876` (original `1dc0aef`). New proof is retained in the [follow-up JSON](../evidence/2026-10-23-material-locale-fixed-iab.json) and [raw observations](../evidence/material-locale-fixed-20261023/observed.json).

Starting with the warning fixture in EN, switching to JA displayed the complete orthotropic explanation in Japanese and confirmed focus=true on `material-status`. Returning to EN restored the initial English text exactly. See [JA](../evidence/material-locale-fixed-20261023/fixed-ja.jpg) and [EN](../evidence/material-locale-fixed-20261023/fixed-en.jpg) screenshots. A separate draft test retained grade=`owned draft retained` while the generic unregistered status switched between EN/JA. That draft check is distinct from the orthotropic-body check.

Formal MCP was not repeated; earlier pairing/revision proof remains tied to its observation. No solver ran, and the owned tab/server closed. Raw observations/images were copied byte-for-byte with text normalization disabled by a dedicated `.gitattributes`, and staged Git blob bytes/hashes were checked. All37 unfinished tasks and original progress remain unchanged.
