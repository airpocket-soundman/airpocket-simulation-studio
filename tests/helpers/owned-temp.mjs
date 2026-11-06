import {mkdtemp,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
/** Only remove the actual dedicated directory created for this test. */
export async function ownedTemp(t,prefix){
 if(typeof prefix!=='string'||!/^[a-z0-9-]{1,80}$/.test(prefix))throw Error('Invalid test directory prefix');
 const parent=await realpath(tmpdir()),dir=await mkdtemp(join(parent,prefix));
 const check=path=>{if(dirname(path)!==parent||!basename(path).startsWith(prefix))throw Error('Test temporary directory escaped its owner');};
 check(dir);t.after(async()=>{const target=await realpath(dir);check(target);await rm(target,{recursive:true,force:true});});return dir;
}
