import {importPrintedMeasurementDataset,importPrintedEquivalentDatasets,PRINTED_DATASET_LIMITS} from '../../src/printed-measurement-dataset.js';
import type {PrintedMeasurementInput} from '../../src/contracts/printed-measurement-dataset';
import {confirmOpeningCandidate,type OpeningCandidateConfirmationInput} from '../../src/opening-candidate-cap.js';
import {createChannelLayerTet4,inspectChannelLayerTet4,CHANNEL_TET4_MAX_WALL_LAYERS,type ChannelLayerTet4Input,type LimitedChannelTet4Geometry} from '../../src/channel-layer-tet4.js';

declare const raw:string;
const normalized=importPrintedMeasurementDataset(raw);
const linked=importPrintedEquivalentDatasets({},[raw]);
const maxBytes:2000000=PRINTED_DATASET_LIMITS.bytes;
// @ts-expect-error crosshead measurements are unsupported
const badDisplacement:PrintedMeasurementInput['specimens'][number]['displacementKind']='crosshead';
// @ts-expect-error units must be explicit supported strings
const badUnit:PrintedMeasurementInput['units']['force']=['N'];
// @ts-expect-error importer accepts raw JSON only
importPrintedMeasurementDataset({schemaVersion:1});

declare const confirmation:OpeningCandidateConfirmationInput;
const confirmed=confirmOpeningCandidate(confirmation);
const confirmedStatus:'confirmed'=confirmed.status;
// @ts-expect-error confirmation must explicitly be true
const unchecked:OpeningCandidateConfirmationInput['confirmation']['confirmed']=false;
// @ts-expect-error version must be numeric
const badVersion:OpeningCandidateConfirmationInput['meshVersion']='7';
// @ts-expect-error exactly three normal coordinates required
const shortNormal:OpeningCandidateConfirmationInput['confirmation']['outwardNormal']=[0,1];

declare const input:ChannelLayerTet4Input;
const mesh=createChannelLayerTet4(input),inspection=inspectChannelLayerTet4(mesh);
const output:'limited-channel-tet4'=mesh.output;
const connected:false=mesh.scope.solverConnected;
const wall:0|1|null=inspection.boundaryFaces[0].wallId;
const maximum:512=CHANNEL_TET4_MAX_WALL_LAYERS;
// @ts-expect-error inspection requires explicit mm
const badMeshUnit:LimitedChannelTet4Geometry['units']='m';
// @ts-expect-error the limited converter does not implement general boundary layers
const badOutput:LimitedChannelTet4Geometry['output']='gmsh';
// @ts-expect-error Tet4 connectivity contains exactly four node ids
const badTet:LimitedChannelTet4Geometry['tetrahedra']=[[0,1,2]];
void [normalized,linked,maxBytes,badDisplacement,badUnit,confirmedStatus,unchecked,badVersion,shortNormal,output,connected,wall,maximum,badMeshUnit,badOutput,badTet];
