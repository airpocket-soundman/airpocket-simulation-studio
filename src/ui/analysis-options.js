// Pure conversion of the mesh/adaptive form values into analysis options.
// The composition root (main.js) reads the DOM elements and passes their raw
// values here, so preflight and solve share exactly one value converter.
// This module imports nothing and performs no DOM access.
export function analysisOptionsFromValues(values){
 return {size:Number(values.size),method:values.method,adaptive:values.adaptive,maxRounds:Number(values.maxRounds),maxAdaptiveElements:Number(values.maxAdaptiveElements),maxAdaptiveSeconds:Number(values.maxAdaptiveSeconds),tolerance:Number(values.tolerance)/100,stressTolerance:Number(values.stressTolerance)/100};
}
