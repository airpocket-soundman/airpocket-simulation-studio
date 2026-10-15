import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {HISTORY_PATH,MAX_HISTORY_POINTS,MAX_HISTORY_SKIPPED,MAX_HISTORY_IDS,MAX_HISTORY_BYTES,summarizeProgressSnapshot,diffTaskIds,validateProgressHistory} from '../src/progress-history.js';
import {statusNames} from '../src/progress.js';

const execute=promisify(execFile),defaultRoot=fileURLToPath(new URL('../',import.meta.url));
export const MAX_SNAPSHOT_BYTES=2_000_000;
export const MAX_TOTAL_SNAPSHOT_BYTES=256_000_000;
const GIT_TIMEOUT_MS=30000;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Run git without a shell. Output is a Buffer limited to maxBuffer. */
export function createGit(root=defaultRoot){
 return async(args,{maxBuffer=1<<20}={})=>(await execute('git',args,{cwd:root,encoding:'buffer',maxBuffer,timeout:GIT_TIMEOUT_MS,windowsHide:true})).stdout;
}
const fail=(code,message)=>Object.assign(Error(message),{code});
/** Read the committed history of src/progress.json through bounded git log/show
 * calls. Every recorded point is one real commit's real file; commits whose file
 * cannot be read are listed as skipped, and missing history (shallow clone, point
 * cap) is declared, never filled in. `git` is injectable for tests. */
export async function collectProgressHistory({root=defaultRoot,git=createGit(root),maxPoints=MAX_HISTORY_POINTS,requireComplete=false,progressBytes}={}){
 if(!Number.isInteger(maxPoints)||maxPoints<1||maxPoints>MAX_HISTORY_POINTS)throw RangeError('Invalid history point limit');
 const text=async args=>(await git(args)).toString('utf8').trim();
 const headRevision=await text(['rev-parse','--verify','HEAD^{commit}']);
 if(!/^[a-f0-9]{40}$/.test(headRevision))throw fail('PROGRESS_HISTORY_GIT','Unexpected HEAD revision');
 const shallowText=await text(['rev-parse','--is-shallow-repository']);
 if(!['true','false'].includes(shallowText))throw fail('PROGRESS_HISTORY_GIT','Unexpected shallow repository answer');
 const shallow=shallowText==='true';
 // Oldest first. --max-count keeps the newest maxPoints+1 commits; the extra one only detects truncation.
 const listing=(await text(['log','--topo-order','--reverse','--max-count='+(maxPoints+1),'--format=%H%x09%cI',headRevision,'--',HISTORY_PATH])).split('\n').filter(Boolean);
 const truncated=listing.length>maxPoints;if(truncated)listing.shift();
 if(!listing.length)throw fail('PROGRESS_HISTORY_EMPTY','No commit touches '+HISTORY_PATH);
 if(requireComplete&&(shallow||truncated))throw fail('PROGRESS_HISTORY_INCOMPLETE','Complete history required but the checkout is '+(shallow?'shallow':'longer than '+maxPoints+' commits'));
 const commits=listing.map(line=>{const [revision,committedAt,...rest]=line.split('\t');if(rest.length||!/^[a-f0-9]{40}$/.test(revision)||!Number.isFinite(Date.parse(committedAt)))throw fail('PROGRESS_HISTORY_GIT','Unexpected git log line');return {revision,committedAt};});
 const points=[],skipped=[];let previousIds=null,totalBytes=0,timestampRegressions=0;
 for(const [index,commit] of commits.entries()){
  if(index>0&&Date.parse(commit.committedAt)<Date.parse(commits[index-1].committedAt))timestampRegressions++;
  let reason=null,summary;
  try{
   let bytes;
   try{bytes=await git(['show',commit.revision+':'+HISTORY_PATH],{maxBuffer:MAX_SNAPSHOT_BYTES});}
   catch(error){reason=error?.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER'?'too-large':'file-absent';}
   if(!reason){
    totalBytes+=bytes.length;if(totalBytes>MAX_TOTAL_SNAPSHOT_BYTES)throw fail('PROGRESS_HISTORY_BYTES','Total snapshot byte limit exceeded');
    let parsed;
    try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch(error){reason=error instanceof SyntaxError?'invalid-json':'invalid-utf8';}
    if(!reason)try{summary=summarizeProgressSnapshot(parsed);}catch{reason='invalid-progress';}
   }
  }catch(error){if(error.code==='PROGRESS_HISTORY_BYTES')throw error;reason='file-absent';}
  if(reason){skipped.push({revision:commit.revision,committedAt:commit.committedAt,reason});if(skipped.length>MAX_HISTORY_SKIPPED)throw fail('PROGRESS_HISTORY_SKIPPED','Too many unreadable progress snapshots');continue;}
  const diff=previousIds?diffTaskIds(previousIds,summary.ids):null;
  points.push({revision:commit.revision,committedAt:commit.committedAt,total:summary.total,counts:Object.fromEntries(statusNames.map(status=>[status,summary.counts[status]])),addedCount:diff?diff.added.length:null,removedCount:diff?diff.removed.length:null,added:diff?diff.added.slice(0,MAX_HISTORY_IDS):[],removed:diff?diff.removed.slice(0,MAX_HISTORY_IDS):[]});
  previousIds=summary.ids;
 }
 let headBytes;
 try{headBytes=await git(['show',headRevision+':'+HISTORY_PATH],{maxBuffer:MAX_SNAPSHOT_BYTES});}catch{throw fail('PROGRESS_HISTORY_GIT',HISTORY_PATH+' is not readable at HEAD');}
 // Git blobs and clean Windows checkouts can differ only by CRLF conversion.
 // Bind to the exact bytes that will be shown, while refusing any other source edit.
 if(progressBytes!==undefined){
  if(!(progressBytes instanceof Uint8Array)||progressBytes.length<1||progressBytes.length>MAX_SNAPSHOT_BYTES)throw fail('PROGRESS_HISTORY_SOURCE_MISMATCH','Invalid progress source bytes');
  const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/\r\n/g,'\n');
  if(decode(progressBytes)!==decode(headBytes))throw fail('PROGRESS_HISTORY_SOURCE_MISMATCH','Progress source differs from committed HEAD');
  headBytes=Buffer.from(progressBytes);
 }
 return validateProgressHistory({schemaVersion:1,kind:'progress-history',path:HISTORY_PATH,statuses:[...statusNames],head:{revision:headRevision,progressSha256:sha256(headBytes),progressBytes:headBytes.length},completeness:{shallow,truncated,maxPoints,commitsListed:commits.length,pointCount:points.length,skippedCount:skipped.length,timestampRegressions},points,skipped});
}
export function serializeProgressHistory(history){
 const bytes=Buffer.from(JSON.stringify(validateProgressHistory(history))+'\n','utf8');
 if(bytes.length>MAX_HISTORY_BYTES)throw fail('PROGRESS_HISTORY_BYTES','Progress history exceeds '+MAX_HISTORY_BYTES+' bytes');
 return bytes;
}
