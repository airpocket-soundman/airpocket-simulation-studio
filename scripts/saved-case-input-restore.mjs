import {readFile,stat} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {getProjectRevision} from '../src/project-revision.js';
import {publishJson} from './json-artifacts.mjs';

const error=(code,message)=>Object.assign(Error(message),{code});
const revision=v=>typeof v==='string'&&/^sha256:[a-f0-9]{64}$/.test(v);
const digest=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
/** Export only the original saved input. No browser state or saved result is applied. */
export async function restoreSavedCaseInput(args,{readSource=readFile,statSource=stat}={}){
 const keys=['path','outputPath','expectedArchiveRevision','caseId','expectedRevision','expectedInputRevision'];
 if(!args||typeof args!=='object'||Array.isArray(args)||![Object.prototype,null].includes(Object.getPrototypeOf(args))||Reflect.ownKeys(args).some(key=>!keys.includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(args,key),'value'))||typeof args.path!=='string'||!isAbsolute(args.path)||typeof args.outputPath!=='string'||!isAbsolute(args.outputPath)||!revision(args.expectedArchiveRevision)||!revision(args.expectedRevision)||!revision(args.expectedInputRevision)||typeof args.caseId!=='string'||!args.caseId)throw error('CASE_INPUT_RESTORE_ARGUMENT_INVALID','Supply absolute source/output paths and archive, case and input revisions');
 const path=resolve(args.path),outputPath=resolve(args.outputPath);
 if(path===outputPath)throw error('CASE_INPUT_RESTORE_PATH_CONFLICT','Use distinct source and output paths');
 const info=await statSource(path);
 if(!info.isFile()||info.size>100000000)throw error('CASE_ARCHIVE_TOO_LARGE','Case archive must be a file up to 100000000 bytes');
 const source=Buffer.from(await readSource(path));if(source.length>100000000)throw error('CASE_ARCHIVE_TOO_LARGE','Case archive exceeds 100000000 bytes');
 const sha256=digest(source),archive=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(source));
 let nextId=0;const cases=createCaseOperations({store:createCaseStore(),id:()=> 'saved-case:'+nextId++});
 const empty=await cases.list();await cases.importArchive({archive,expectedArchiveRevision:empty.archiveRevision});
 const catalog=await cases.list();if(catalog.archiveRevision!==args.expectedArchiveRevision)throw error('CASE_REVISION_CONFLICT','Saved case archive changed; list cases again');
 const lease=await cases.readSource({caseId:args.caseId,expectedRevision:args.expectedRevision});
 const input=lease.output.input,inputRevision=await getProjectRevision(input);lease.assertCurrent();
 if(inputRevision!==args.expectedInputRevision)throw error('INPUT_INSPECTION_REVISION_CONFLICT','Input revision differs from the inspected version');
 const response={schemaVersion:1,archiveRevision:catalog.archiveRevision,caseId:lease.caseId,caseRevision:lease.revision,name:lease.name,inputRevision,outputPath,source:{kind:'saved-case-archive',sha256,bytes:source.length,identityScope:'snapshot-local deterministic IDs; valid only with matching case and archive revisions'},limitations:['Only saved input was exported; no saved result was restored and no analysis was executed.','Saved provenance and assumptions are preserved; no physical validation or source authentication is implied.']};
 const current=Buffer.from(await readSource(path));if(current.length!==source.length||digest(current)!==sha256)throw error('CASE_ARCHIVE_SOURCE_CHANGED','Source case archive changed during input export; list cases again');
 lease.assertCurrent();
 const publication=await publishJson(outputPath,input,{includeIntegrity:true});
 return {...response,...publication};
}
