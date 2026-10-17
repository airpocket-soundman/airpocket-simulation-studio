import {acousticWaveNumber} from './acoustic-radiation.js';
export const ACOUSTIC_ELEMENTS_PER_WAVELENGTH=6;
/** Existing solver limits, shared with read-only post-mesh inspection. No accuracy guarantee. */
export function acousticResolutionLimits({frequency,soundSpeed,lossFactor=.01,transient=false,pulseWidth=.0002}){
 if(transient){
  if(![frequency,soundSpeed,pulseWidth].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid transient acoustic resolution inputs');
  const bandwidthHz=frequency+3/(2*Math.PI*pulseWidth),wavelengthMm=soundSpeed/bandwidthHz*1000;
  return {bandwidthHz,wavelengthMm,maxEdgeMm:wavelengthMm/ACOUSTIC_ELEMENTS_PER_WAVELENGTH};
 }
 const wave=acousticWaveNumber({frequency,soundSpeed,lossFactor}),wavelengthMm=2*Math.PI/wave.real*1000;
 return {wavelengthMm,maxEdgeMm:wavelengthMm/ACOUSTIC_ELEMENTS_PER_WAVELENGTH,maxTargetSizeMm:soundSpeed/frequency*1000/ACOUSTIC_ELEMENTS_PER_WAVELENGTH};
}
export function acousticEdgeResolved(maxEdgeMm,limits){return maxEdgeMm>0&&maxEdgeMm<=limits.maxEdgeMm;}
