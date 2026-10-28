# Limited channel node velocity policy

[日本語](../channel-node-velocity-policy.md)

`src/channel-node-velocity-policy.js` is a pure adapter from the existing [face boundary manifest](channel-layer-boundary-transfer.md) to velocity-component constraints using original node IDs. It regenerates and validates the original transfer first. It does not replace the face manifest, project or solver input. Scope is the existing axis-aligned parallel-plate Tet4 channel with +x flow, excluding general geometry, oblique normals, flow solves and y+.

Call `createChannelNodeVelocityPolicy({input,transfer,policy:CHANNEL_NODE_VELOCITY_POLICY})` with the original transfer input/output. The only explicit policy is `wall-over-inlet-at-shared-nodes`; omission and automatic selection are refused.

No-slip walls assign three zero velocity components. Non-wall inlet nodes retain the explicit positive-x inlet velocity. Shared inlet/wall nodes use wall zero, with the overridden inlet intent retained in `overriddenInletNodeIds`. Every node retains all boundary memberships and per-component assignment sources. Symmetry assigns only zero z velocity after regeneration confirms zMin=[0,0,-1] and zMax=[0,0,1]. It leaves x/y unconstrained and does not implement arbitrary-normal projection.

`velocityMps` is `[number|null,number|null,number|null]`. **null means unconstrained, not zero.** Outlet pressure remains in `outletFaceConditions:{faceId,pressurePa}[]`; no nodal pressure is generated or implicitly added to wall corners. This is an auditable exchange of limited policy intent, not proof of correct Navier–Stokes discretization or applied solver BCs.

The schemaVersion1 result binds meshRevision, transferRevision, policyRevision, m/s, Pa and scope. Original input/manifest are revalidated around asynchronous hashing and regenerated manifests compared. `validateChannelNodeVelocityPolicy(options,received)` regenerates every field after JSON reload, rejecting even self-rehashed edits to nodes, components, memberships, sources, outlet faces and policy. Inputs remain unchanged and output is detached. Nodes are sorted by original ID; object property order is irrelevant while changed array order is not silently accepted.

Limits are the existing 512 wall layers /2056 nodes, 1,000,000 UTF-8 output bytes, 100000 received values and depth10. Nonfinite values, unknown policies, oversized records and accessors are refused. Maximum-capacity output passes reload validation. The seven-cell/42Tet reference has32 nodes, eight wall nodes, four shared wall/inlet nodes,72 constrained and24 unconstrained velocity components, and14 outlet faces. An independent coordinate-derived set oracle verifies every node.

`solverConnected:false` and `projectBoundaryApiConnected:false` remain explicit. Solver integration, general BCs, fluid accuracy and parent CFDMESH1 acceptance remain incomplete. No real solver, SDK acquisition, main or shared progress changes were performed.
