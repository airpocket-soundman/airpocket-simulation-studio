import {publishJson} from './json-artifacts.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,basename,extname} from 'node:path';
import initializeOcct from 'occt-import-js';
import {createProjectFromStep,createProjectFromStl,createProjectFromBuiltin,STEP_IMPORT_OPTIONS,MAX_IMPORT_BYTES} from '../src/project-import.js';
import {stat} from 'node:fs/promises';

let cad;
/** Real Node CAD adapter. STEP units are normalized by OCCT to mm. */
export async function importProjectFile(path,options={}){
  const extension=extname(path).toLowerCase();
  if(!['.step','.stp','.stl'].includes(extension))throw Error('Supported model files: STEP, STP, STL.');
  if((await stat(path)).size>MAX_IMPORT_BYTES)throw Error('Import exceeds 50 MB.');
  const bytes=new Uint8Array(await readFile(path)),settings={name:basename(path),...options};
  if(extension==='.stl')return createProjectFromStl({...settings,bytes});
  if(options.scaleToMm!==undefined)throw Error('STEP uses embedded units; scaleToMm is only for STL.');
  cad??=initializeOcct();const occt=await cad,result=occt.ReadStepFile(bytes,{...STEP_IMPORT_OPTIONS});
  return createProjectFromStep({...settings,bytes,result,linearUnit:'millimeter'});
}
export {createProjectFromBuiltin};

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try {
    const [input,output,scale]=process.argv.slice(2);
    if(!input||!output)throw Error('Usage: node scripts/import-project.mjs model.step project.json [stlScaleToMm]');
    const project=await importProjectFile(input,scale===undefined?{}:{scaleToMm:Number(scale)});
    if(resolve(input)===resolve(output))throw Error('Use distinct input and output paths.');await publishJson(resolve(output),project);console.log(`Saved ${project.meshes.length} meshes to ${output}`);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
