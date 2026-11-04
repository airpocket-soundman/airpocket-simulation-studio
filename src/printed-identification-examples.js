// Invented, exact algorithm examples. Not measured data or material recommendations.
const names=['linear-elastic','bilinear-elastic-plastic','sls-relaxation'];
export function printedIdentificationExample(model){
 if(!names.includes(model))throw Object.assign(Error('Unsupported synthetic identification example'),{code:'PRINTED_IDENTIFICATION_EXAMPLE_INVALID'});
 const options={model,maxStrain:model==='linear-elastic'?.01:model==='bilinear-elastic-plastic'?.04:.01,minPoints:5,maxRelativeStandardError:.05};
 let rows,truth,formula;
 if(model==='linear-elastic'){
  truth={youngsModulusPa:1e9};formula='stress = 1e9 Pa × strain';
  rows=Array.from({length:21},(_,i)=>{const e=i*.0005;return [i,truth.youngsModulusPa*e*1e-6,e*10];});
 }else if(model==='bilinear-elastic-plastic'){
  options.maxTangentRatio=.5;truth={youngsModulusPa:2e9,yieldStressPa:2e7,tangentModulusPa:1e8};formula='stress = 2e9 Pa × min(strain,0.01) + 1e8 Pa × max(strain−0.01,0)';
  rows=Array.from({length:101},(_,i)=>{const e=i*.0004,p=2e9*Math.min(e,.01)+1e8*Math.max(e-.01,0);return [i,p*1e-6,e*10];});
 }else{
  options.holdStrainTolerance=1e-6;truth={equilibriumModulusPa:1.2e9,branchModulusPa:.8e9,relaxationTimeS:2};formula='held strain = 0.004; stress = 0.004 × (1.2e9 + 0.8e9 exp(−(t−1)/2)) Pa';
  rows=[[0,0,0],...Array.from({length:81},(_,i)=>[1+i*.25,.004*(1.2e9+.8e9*Math.exp(-i*.25/2))*1e-6,.004*10])];
 }
 const raw=JSON.stringify({schemaVersion:1,id:'synthetic-identification-'+model,revision:'1',provenance:'synthetic',units:{length:'mm',force:'N',time:'s',temperature:'degC',speed:'mm/s'},instrument:{id:'invented-algorithm-example-no-device',hardwareRevision:'synthetic-1',softwareRevision:'synthetic-1'},calibration:{status:'unverified',forceEvidence:null,displacementEvidence:null,dimensionEvidence:null},specimens:[{id:'synthetic-example',dimensions:[1,1,10],gaugeLength:10,buildDirection:[0,0,1],batch:'invented-no-physical-batch',temperature:20,speed:.1,displacementKind:'gauge',samples:rows}]},null,2);
 return {raw,options,truth,formula};
}
