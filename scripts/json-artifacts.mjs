import {randomUUID} from 'node:crypto';
import {createHash} from 'node:crypto';
import {open,link,unlink} from 'node:fs/promises';

// The final name appears only after the complete file has been written.
// Hard-link publication fails if a destination already exists (including symlinks).
export async function publishJson(path,value,{includeIntegrity=false}={}){
 const temporary=path+'.'+randomUUID()+'.tmp';let owned=false,published=false,cleanupWarning;
 const json=JSON.stringify(value)+'\n';
 try{const file=await open(temporary,'wx');owned=true;try{await file.writeFile(json);}finally{await file.close();}await link(temporary,path);published=true;}
 finally{if(owned)try{await unlink(temporary);}catch(error){if(published)cleanupWarning={code:'ARTIFACT_TEMP_CLEANUP_FAILED',path:temporary,message:error.message};}}
 return {...(includeIntegrity?{outputBytes:Buffer.byteLength(json),outputSha256:createHash('sha256').update(json).digest('hex')}:{ } ),...(cleanupWarning?{cleanupWarning}:{})};
}
