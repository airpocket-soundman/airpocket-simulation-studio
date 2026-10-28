import fs from 'node:fs';import {rpc} from './call.mjs';
export const directory=new URL('./',import.meta.url);export const save=(n,v)=>fs.writeFileSync(new URL(n,directory),JSON.stringify(v,null,2)+'\n');
const sessionId='35f2370b-bdad-4567-87eb-77054b7b0cfe';
export async function live(method,args={}){const contract=new URL('contract-'+method+'.json',directory);if(!fs.existsSync(contract))save('contract-'+method+'.json',await rpc('studio_browser_contracts',{method}));return rpc('studio_browser_call',{sessionId,method,args});}
