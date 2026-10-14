import {randomUUID} from 'node:crypto';
import {open,link,unlink} from 'node:fs/promises';

// The final name appears only after the complete file has been written.
// Hard-link publication fails if a destination already exists (including symlinks).
export async function publishJson(path,value){
 const temporary=path+'.'+randomUUID()+'.tmp';let owned=false,published=false,cleanupWarning;
 try{const json=JSON.stringify(value)+'\n',file=await open(temporary,'wx');owned=true;try{await file.writeFile(json);}finally{await file.close();}await link(temporary,path);published=true;}
 finally{if(owned)try{await unlink(temporary);}catch(error){if(published)cleanupWarning={code:'ARTIFACT_TEMP_CLEANUP_FAILED',path:temporary,message:error.message};}}
 return cleanupWarning?{cleanupWarning}:{};
}
