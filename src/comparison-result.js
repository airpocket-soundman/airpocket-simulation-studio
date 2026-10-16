import {framesOf,defaultFrameIndex} from './result-frames.js';
import {resultFields} from './result-view-api.js';

const finalOnly=(result,field,frames)=>result.kind==='thermal'&&result.transient&&(field==='heatFlux'||!frames);
// A time axis belongs to a stored field, never to final-only derived quantities.
export function inspectComparisonResult(result,field){
 const frames=framesOf(result),timeField=frames&&(!field||field===frames.fieldId);
 return {fields:resultFields(result).map(f=>f.id),frameTimes:timeField?frames.times:null,
  ...(finalOnly(result,field,frames)?{finalOnly:true}:{})};
}

export function comparisonFrame(result,field,frameIndex){
 if(!resultFields(result).some(f=>f.id===field))throw Error('Field is unavailable for this result');
 const frames=framesOf(result);
 if(frameIndex!==undefined&&frameIndex!==null){
  if(!frames||!Number.isInteger(frameIndex)||frameIndex<0||frameIndex>=frames.times.length)throw Error('Invalid stored comparison frame index');
  if(field!==frames.fieldId)throw Error('Field is unavailable at stored time frames; heat flux is final-step only');
 }
 const selected=frameIndex??defaultFrameIndex(result);
 return {frameIndex:selected,...(frames&&field===frames.fieldId?{physicalTimeSeconds:frames.times[selected],timeSelection:'stored-frames-only'}:{}),
  ...(finalOnly(result,field,frames)?{finalOnly:true}:{})};
}
