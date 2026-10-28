import {createRetainedOpeningSurfaceProvider,RETAINED_OPENING_SURFACE_LIMITS,type RetainedOpeningSurfaceInput} from '../../src/retained-opening-surface.js';
import type {RetainedOpeningSurfaceLease} from '../../src/contracts/retained-opening-surface';
const provider=createRetainedOpeningSurfaceProvider();
const pendingLimit:2=RETAINED_OPENING_SURFACE_LIMITS.pending;void pendingLimit;
const input:RetainedOpeningSurfaceInput={units:'mm',topologyIntent:'open-indexed-surface',sourceIdentity:'caller-reference',mesh:{nodes:[0,0,0,1,0,0,0,1,0],triangles:[[0,1,2]],toleranceMm:1e-6}};
const lease:RetainedOpeningSurfaceLease=await provider.replace(input);
const cap=provider.confirm(lease,{confirmed:true,capId:'opening',candidate:lease.analysis.candidates[0],outwardNormal:[0,0,1],interiorPointMm:[0,0,-1],enclosure:[-2,-2,-2,4,4,4]});
const generation:number=cap.generation;void generation;
// @ts-expect-error No geometry may be obtained/mutated through a lease.
lease.mesh.nodes[0]=1;
// @ts-expect-error Analysis metadata and candidate IDs are immutable.
lease.analysis.candidates[0].nodeIndices[0]=4;
// @ts-expect-error Caller cannot manufacture an issued lease from its visible fields.
provider.release({kind:'retained-opening-surface',generation:1,contentRevision:'sha256:...',sourceIdentity:'caller',units:'mm',topologyIntent:'open-indexed-surface',analysis:lease.analysis});
// @ts-expect-error Closed volume is not an explicit indexed opening-surface contract.
provider.replace({...input,topologyIntent:'closed-volume'});
provider.clear();provider.dispose();
