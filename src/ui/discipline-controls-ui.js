// Discipline-dependent input visibility and control availability.
// DOM access and current application state are injected by the composition root.
export function createDisciplineControlsUi({$,querySelector,querySelectorAll,getState}){
 return function updateDisciplineControls(){
  const {kind,conditions,materialProperties,sourceModel,running,modalEnabled,solver}=getState();
  if(!running)$('solve-run').disabled=kind==='fluidDomain'||conditions.some(c=>c.cadUpdateRequired);
  const plastic=kind==='structural'&&!!materialProperties.plasticity;
  $('plastic-load-fractions').disabled=!plastic;
  if(!plastic)$('plastic-load-fractions').value='';
  $('nonlinear-steps').disabled=plastic&&!!$('plastic-load-fractions').value.trim();
  if($('nonlinear-steps').disabled)$('nonlinear-steps').value=$('plastic-load-fractions').value.split(',').length;
  const hyper=kind==='structural'&&(!!materialProperties.hyperelastic||!!materialProperties.plasticity||modalEnabled);
  for(const method of ['webgpu-pcg','mfem-wasm'])querySelector('#solver option[value="'+method+'"]').disabled=kind!=='structural'||hyper;
  if((kind!=='structural'||hyper)&&['webgpu-pcg','mfem-wasm'].includes(solver))$('solver').value='wasm-pcg';
  $('adaptive-run').disabled=kind!=='structural'||hyper||sourceModel?.kind==='stl';
  if(kind!=='structural'||hyper||sourceModel?.kind==='stl')$('adaptive-run').checked=false;
  for(const el of querySelectorAll('[data-physics]')){
   el.hidden=!el.dataset.physics.split(' ').includes(kind);
   if(!el.hidden&&['channelFlow','creepingFlow'].includes(kind)&&el.tagName==='DETAILS')el.open=true;
  }
 };
}
