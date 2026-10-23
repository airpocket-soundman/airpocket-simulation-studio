import {confirmOpeningCandidate, type OpeningCandidateConfirmationInput} from '../../src/contracts/opening-candidate-cap';
declare const input: OpeningCandidateConfirmationInput;
const result = confirmOpeningCandidate(input);
const status: 'confirmed' = result.status;
const version: number = result.meshVersion;
// @ts-expect-error explicit confirmation cannot be omitted
const missing: OpeningCandidateConfirmationInput['confirmation'] = {meshVersion: 1};
// @ts-expect-error normals require exactly three coordinates
const invalidNormal: OpeningCandidateConfirmationInput['confirmation']['outwardNormal'] = [0, 1];
void [status, version, missing, invalidNormal];
