// node scripts/create-increment-curve-bundle.mjs --forces 0,25,50,100,50,0 --out /abs/bundle.json [--size 4]
// Synthetic independent linear solves only; the output is a spec/steps bundle for increment-curve export tools.
import {writeSyntheticBarBundle} from './increment-curve-bundle.mjs';

const args=process.argv.slice(2),option=name=>{const index=args.indexOf('--'+name);return index<0?undefined:args[index+1];};
const forces=(option('forces')??'').split(',').filter(Boolean).map(Number),out=option('out');
const size=option('size')===undefined?undefined:Number(option('size'));
try{
  const result=await writeSyntheticBarBundle({forces,...(size===undefined?{}:{size})},out);
  console.log(JSON.stringify({outputPath:result.outputPath,outputBytes:result.outputBytes,outputSha256:result.outputSha256,rows:result.steps.map(({stepId,status,extensionMm,engineeringStressPa,engineeringStrain})=>({stepId,status,extensionMm,engineeringStressPa,engineeringStrain}))}));
}catch(error){console.error(error.message);process.exitCode=1;}
