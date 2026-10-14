import {test} from 'node:test';import assert from 'node:assert/strict';
import {getObservationProfiles,resolveObservationProfile} from '../src/observation-profiles.js';
const project=model=>({study:{kind:'structural'},materialProperties:{[model]:{}}});
test('nonlinear profiles declare load-indexed vector3 displacement in millimetres',()=>{
 for(const model of ['plasticity','hyperelastic'])for(const target of ['browser','node']){
  const selected=resolveObservationProfile(project(model),{includeFields:true},target),field=selected.profile.fields[0];
  assert.equal(selected.profileId,model+'-cpu');assert.equal(selected.profile.fields.length,1);assert.equal(field.kind,'structuralDisplacement');assert.equal(field.name,'displacement');assert.equal(field.unit,'mm');assert.equal(field.valueType,'vector3');assert.deepEqual(field.components,['x','y','z']);assert.equal(field.loadFactorUnit,'dimensionless');assert.match(field.cadence,/converged load step/);assert.match(field.cadence,/not physical time/);assert.equal(field.timeUnit,undefined);
  assert.equal(selected.fieldRetention.requested,true);assert.equal(selected.fieldRetention.available,true);assert.equal(selected.fieldRetention.scalarFieldsSupported,false);assert.equal(selected.fieldRetention.vectorFieldsSupported,true);assert.equal(selected.fieldRetention.meshSupported,true);assert.equal(selected.fieldRetention.meshAvailable,true);assert.equal(selected.fieldRetention.availabilityIsGuarantee,false);
 }
});
test('vector support is independent of retention request and unsupported combinations expose no field capability',()=>{
 for(const model of ['plasticity','hyperelastic']){
  const omitted=resolveObservationProfile(project(model));assert.equal(omitted.fieldRetention.requested,false);assert.equal(omitted.fieldRetention.available,false);assert.equal(omitted.fieldRetention.vectorFieldsSupported,true);assert.equal(omitted.fieldRetention.scalarFieldsSupported,false);assert.equal(omitted.fieldRetention.meshAvailable,false);assert.equal(omitted.fieldRetention.meshSupported,true);
  for(const options of [{method:'webgpu-pcg',includeFields:true},{adaptive:true,includeFields:true},{includeFields:'true'}]){const unsupported=resolveObservationProfile(project(model),options);assert.equal(unsupported.supported,false);for(const key of ['available','vectorFieldsSupported','scalarFieldsSupported','meshSupported','meshAvailable'])assert.equal(unsupported.fieldRetention[key],false);}
 }
});
test('mesh-only requests do not advertise structural fields and scalar profiles remain independent',()=>{
 const mesh=resolveObservationProfile(project('plasticity'),{includeFields:true},'browser','mesh');assert.equal(mesh.profileId,'mesh');assert.deepEqual(mesh.profile.fields,[]);assert.equal(mesh.fieldRetention.meshAvailable,true);assert.equal(mesh.fieldRetention.available,false);assert.equal(mesh.fieldRetention.vectorFieldsSupported,false);
 const thermal=resolveObservationProfile({study:{kind:'thermal'}},{includeFields:true});assert.equal(thermal.fieldRetention.scalarFieldsSupported,true);assert.equal(thermal.fieldRetention.vectorFieldsSupported,false);assert.equal(thermal.fieldRetention.available,true);
 const linear=resolveObservationProfile({study:{kind:'structural'}},{includeFields:true});assert.equal(linear.fieldRetention.meshAvailable,true);assert.equal(linear.fieldRetention.available,false);
});
test('the metadata catalog count and clone independence are retained',()=>{
 assert.equal(getObservationProfiles().length,13);assert.equal(getObservationProfiles({target:'node'}).length,12);
 const selected=resolveObservationProfile(project('plasticity'),{includeFields:true});selected.profile.fields[0].components[0]='bad';assert.deepEqual(resolveObservationProfile(project('plasticity')).profile.fields[0].components,['x','y','z']);
 assert.equal(selected.declarationOnly,true);assert.equal(selected.physicalAccuracyVerified,false);
});
