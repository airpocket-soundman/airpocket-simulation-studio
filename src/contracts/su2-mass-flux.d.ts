/** Availability only: no SU2 numerical boundary-flux export format has been proven. */
export interface Su2DiscreteMassFluxUnavailable {
 schemaVersion: 1;
 supported: false;
 status: 'unavailable';
 code: 'SU2_DISCRETE_BOUNDARY_FLUX_UNAVAILABLE';
 quantity: 'solver-numerical-boundary-mass-flux';
 solver: 'SU2';
 version: '8.5.0';
 units: null;
 source: 'numerical-boundary-residual-not-exported';
 nodalSurfaceMassflowIsDiscreteFlux: false;
 dimensionSpecificNormalizationVerified: false;
 physicalAcceptanceComplete: false;
}
