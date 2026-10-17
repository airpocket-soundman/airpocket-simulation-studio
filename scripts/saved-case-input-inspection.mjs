import {readFile,stat} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {inspectProjectInput} from '../src/project-input-inspection.js';

const error=(code,message)=>Object.assign(Error(message),{code});
const revision=v=>typeof v==='string'&&/^sha256:[a-f0-9]{64}$/.test(v);
const digest=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
/** Node saved-file adapter. Reuses case validation/identity and bounded input pages;
 * it never applies a case, executes a solver or invents absent provenance. */
export async function inspectSavedCaseInput(args,{readSource=readFile,statSource=stat}={}){
 const keys=['path','expectedArchiveRevision','caseId','expectedRevision','expectedInputRevision','section','pointer','offset','limit'];
 if(!args||typeof args!=='object'||Array.isArray(args)||![Object.prototype,null].includes(Object.getPrototypeOf(args))||Reflect.ownKeys(args).some(key=>!keys.includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(args,key),'value'))||typeof args.path!=='string'||!isAbsolute(args.path)||!revision(args.expectedArchiveRevision)||!revision(args.expectedRevision)||typeof args.caseId!=='string'||!args.caseId||typeof args.section!=='string'||args.expectedInputRevision!==undefined&&!revision(args.expectedInputRevision))throw error('CASE_INPUT_ARGUMENT_INVALID','Supply absolute path, archive/case identities and input section');
 const path=resolve(args.path),info=await statSource(path);
 if(!info.isFile()||info.size>100000000)throw error('CASE_ARCHIVE_TOO_LARGE','Case archive must be a file up to 100000000 bytes');
 const source=Buffer.from(await readSource(path));if(source.length>100000000)throw error('CASE_ARCHIVE_TOO_LARGE','Case archive exceeds 100000000 bytes');
 const sha256=digest(source),archive=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(source));
 let nextId=0;const cases=createCaseOperations({store:createCaseStore(),id:()=> 'saved-case:'+nextId++});
 const empty=await cases.list();await cases.importArchive({archive,expectedArchiveRevision:empty.archiveRevision});
 const catalog=await cases.list();if(catalog.archiveRevision!==args.expectedArchiveRevision)throw error('CASE_REVISION_CONFLICT','Saved case archive changed; list cases again');
 const lease=await cases.readSource({caseId:args.caseId,expectedRevision:args.expectedRevision});
 const query={section:args.section};for(const key of ['pointer','offset','limit'])if(Object.hasOwn(args,key))query[key]=args[key];
 if(Object.hasOwn(args,'expectedInputRevision'))query.expectedRevision=args.expectedInputRevision;
 const input=await inspectProjectInput(lease.output.input,query);lease.assertCurrent();
 const response={schemaVersion:1,archiveRevision:catalog.archiveRevision,caseId:lease.caseId,caseRevision:lease.revision,name:lease.name,input,source:{kind:'saved-case-archive',sha256,bytes:source.length,identityScope:'snapshot-local deterministic IDs; valid only with matching case and archive revisions'}};
 if(Buffer.byteLength(JSON.stringify(response))>65536)throw error('CASE_INPUT_RESPONSE_TOO_LARGE','Case input response exceeds 65536 UTF-8 bytes; request fewer entries');
 const current=Buffer.from(await readSource(path));if(current.length!==source.length||digest(current)!==sha256)throw error('CASE_ARCHIVE_SOURCE_CHANGED','Source case archive changed during inspection; list cases again');
 return response;
}
