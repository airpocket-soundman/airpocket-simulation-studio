import {createNativeTet4RecordFromBoundarySelections} from '../../scripts/native-tet4-boundary-selection.mjs';
const request={input:{},mesh:{nodes:[0,0,0],tets:[]},fixedNodeSets:[{id:'bottom',nodeIds:[0,1,2]}],nodalLoads:[]};
createNativeTet4RecordFromBoundarySelections(request).then(record=>{const units:'mm-Pa-N'=record.units;void units;});
// @ts-expect-error global nodal force requires exactly three components
createNativeTet4RecordFromBoundarySelections({...request,nodalLoads:[{nodeId:3,forceN:[1,2]}]});
// @ts-expect-error face integration is deliberately unsupported
createNativeTet4RecordFromBoundarySelections({...request,faceLoads:[]});
