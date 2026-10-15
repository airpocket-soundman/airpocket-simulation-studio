// Registry of per-discipline execution adapters used by analysis.worker.js.
// The worker owns acceptance, validation, meshing, progress, failure mapping and result delivery;
// an adapter only turns a prepared mesh + boundary into a discipline result.
// Adding a discipline = add an adapter module + one entry in `adapters` below.
import {creepingFlowAdapter} from './creeping-flow-adapter.js';
import {channelFlowAdapter} from './channel-flow-adapter.js';
import {acousticAdapter} from './acoustic-adapter.js';
import {thermalAdapter} from './thermal-adapter.js';
import {structuralAdapter} from './structural-adapter.js';
const adapters=[creepingFlowAdapter,channelFlowAdapter,acousticAdapter,thermalAdapter,structuralAdapter];
const byKind=new Map();
for(const a of adapters){if(byKind.has(a.kind))throw Error('Duplicate solver adapter '+a.kind);byKind.set(a.kind,a);}
// Legacy default: a study whose kind is not registered (including a missing kind) runs as structural,
// exactly as the previous if/else chain in analysis.worker.js did.
export const legacyDefaultKind='structural';
export const solverAdapterKinds=Object.freeze([...byKind.keys()]);
export function getSolverAdapter(kind){return byKind.get(kind);}
export function resolveSolverAdapter(study){return byKind.get(study?.kind)??byKind.get(legacyDefaultKind);}
