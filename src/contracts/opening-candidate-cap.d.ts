export type OpeningVector = [number, number, number];
export interface ConfirmableOpeningCandidate {
 id: string; nodeIndices: number[]; pointsMm: OpeningVector[];
 plane: {pointMm: OpeningVector; normal: OpeningVector; residualMm: number};
 normal: OpeningVector; outward: 'undetermined'; areaMm2: number;
 perimeterMm: number; convex: true; triangleIndices: number[];
}
export interface OpeningCandidateConfirmationInput {
 mesh: {nodes: number[]; triangles: number[][]; toleranceMm: number};
 meshVersion: number; enclosure: [number, number, number, number, number, number];
 confirmation: {confirmed: true; meshVersion: number; capId: string;
 candidate: ConfirmableOpeningCandidate; outwardNormal: OpeningVector; interiorPointMm: OpeningVector};
}
export interface ConfirmedOpeningCap {
 status: 'confirmed'; meshVersion: number; candidateId: string; nodeIndices: number[]; toleranceMm: number;
 source: {mode: 'internal'; enclosure: number[]; seedPoint: OpeningVector;
 openingCaps: {id: string; point: OpeningVector; normal: OpeningVector}[]};
}
export declare function confirmOpeningCandidate(input: OpeningCandidateConfirmationInput): ConfirmedOpeningCap;
