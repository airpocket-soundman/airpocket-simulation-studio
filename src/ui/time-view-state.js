// Preserve the viewer's exact display time and its labels without replaying rounded slider input.
export function createTimeViewState({$,getState,setState,stop=()=>{}}){
 const controls=[['acoustic-time-frame','value'],['acoustic-time-fine','value'],['acoustic-time-label','textContent'],['acoustic-time-interpolated','textContent']];
 return {
  getTimeView(){
   stop();
   return {state:{...getState()},controls:controls.flatMap(([id,key])=>{const el=$(id);return el?[{id,key,value:el[key]}]:[];})};
  },
  restoreTimeView(saved){
   if(!saved)return;
   setState({...saved.state});
   for(const {id,key,value} of saved.controls){const el=$(id);if(el)el[key]=value;}
  },
  selectStoredFrame(frameIndex){
   if(frameIndex===null||frameIndex===undefined)return false;
   stop();setState({...getState(),frameIndex,timeSeconds:null});
   const slider=$('acoustic-time-frame');
   if(!slider)return false;
   slider.value=frameIndex;slider.oninput();return true;
  }
 };
}
