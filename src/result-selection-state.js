/** Private presentation generations. No DOM, result payload or saved identity.
 * A guard belongs to one selection lifetime, even if A is selected again after B.
 * Invalidation cancels pending publication; it does not abort solver execution. */
export function createResultSelectionState(){
 let generation={},disposed=false;
 const invalidate=()=>{if(!disposed)generation={};};
 return Object.freeze({
  capture(){const observed=generation;return ()=>!disposed&&generation===observed;},
  invalidate,
  dispose(){disposed=true;generation=null;}
 });
}
