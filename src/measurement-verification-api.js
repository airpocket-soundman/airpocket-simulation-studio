import {canonicalJson,getProjectRevision} from './project-revision.js';
import {verifyMeasurementArchive} from './measurement-verification.js';
const revision=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
/** Read-only checks of history against a stable pair of saved archives. */
export function createMeasurementVerificationApi({getCaseArchive,measurements,isBusy=()=>false}){
 if(typeof measurements?.matchesArchive!=='function')throw TypeError('Synchronous measurement archive check is required');
 return Object.freeze({async verify(args={}, {guard=()=>true}={}){
  const command=JSON.parse(canonicalJson(args));
  if(!command||Array.isArray(command)||Object.keys(command).length!==2||!revision(command.expectedArchiveRevision)||!revision(command.expectedCaseArchiveRevision))throw Error('Expected measurement and case archive revisions are required');
  const check=()=>{if(isBusy()||!guard())throw Error('Measurement verification busy or command expired');};check();
  const history=await measurements.exportArchive(),caseArchive=JSON.parse(canonicalJson(getCaseArchive())),caseArchiveRevision=await getProjectRevision(caseArchive);
  if(history.archiveRevision!==command.expectedArchiveRevision||caseArchiveRevision!==command.expectedCaseArchiveRevision)throw Error('Measurement verification archive revision conflict');
  const proof=await verifyMeasurementArchive({caseArchive,measurementArchive:history.archive});
  const latest=await measurements.exportArchive();
  if(latest.archiveRevision!==history.archiveRevision||!measurements.matchesArchive(history.archive)||canonicalJson(getCaseArchive())!==canonicalJson(caseArchive))throw Error('Measurement verification archives changed');check();
  return {...proof,archiveRevision:history.archiveRevision,caseArchiveRevision};
 }});
}
