import assert from 'node:assert/strict';
import {resolveObservationProfile} from '../../src/observation-profiles.js';

// Browser worker requests run in the Node harness; WebGPU is the actual CPU fallback.
export function assertObservedProfile(project,options,operation,messages){
 const selected=resolveObservationProfile(project,options,'browser',operation==='mesh'?'mesh':'solve');
 assert.equal(selected.supported,true);
 const events=messages.flatMap(message=>message.event?[message.event]:typeof message.progress==='string'?[{stage:'progress'}]:[]);
 assert.ok(events.some(event=>event.stage==='preparation'));
 assert.ok(events.some(event=>event.stage==='mesh'));
 assert.ok(events.some(event=>event.stage==='progress'));
 for(const event of events){
  const declaration=selected.profile.events.find(item=>item.stage===event.stage&&item.solver===event.solver&&item.kind===event.kind);
  assert.ok(declaration,selected.profileId+' undeclared event '+JSON.stringify({stage:event.stage,solver:event.solver,kind:event.kind}));
  if(event.field){
   const field=selected.profile.fields.find(item=>item.kind===event.field.kind);
   assert.ok(field,selected.profileId+' undeclared field');
   assert.ok(Array.isArray(event.field[field.name]));
   assert.equal(event.field.units[field.name],field.unit);
  }
 }
 for(const declared of selected.profile.events.filter(item=>!['preparation','mesh','progress'].includes(item.stage)&&(!item.when||item.when==='frequency-sweep'&&project.study.sweep)))assert.ok(events.some(event=>event.stage===declared.stage&&event.solver===declared.solver&&event.kind===declared.kind),selected.profileId+' did not exercise declared numerical path');
 if(!selected.profile.fields.length)assert.ok(events.every(event=>event.field===undefined));
 return selected;
}
