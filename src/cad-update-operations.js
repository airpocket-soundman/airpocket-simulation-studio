import {planCadUpdate} from './cad-update.js';
import {canonicalJson,getProjectRevision} from './project-revision.js';

const snapshot=value=>JSON.parse(JSON.stringify(value));
const revision=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
function page(reports,offset,limit){
  return reports.slice(offset,offset+limit).map(r=>({index:r.index,type:r.type,status:r.status,reason:r.reason,previousAreaMm2:r.previousAreaMm2,
    regionCount:r.regions.length,triangleCount:r.regions.reduce((n,region)=>n+region.triangles.length,0),
    faceCount:r.faces.length}));
}

/** The browser stores display vertices in Float32BufferAttributes and exports only
 * these mesh properties. Reject lossy inputs rather than report a false revision. */
export function validateBrowserCadReplacement(replacement){
  canonicalJson(replacement);
  if(Object.hasOwn(replacement,'name')&&typeof replacement.name!=='string')throw new TypeError('Browser CAD replacement name must be a string when present.');
  if(!Array.isArray(replacement?.meshes))throw new TypeError('Browser CAD replacement requires a meshes array.');
  for(const mesh of replacement.meshes){
    if(!mesh||Array.isArray(mesh)||typeof mesh!=='object'||mesh.kind!=='cad'||Object.keys(mesh).some(key=>!['positions','faceIds','kind','sourceHash'].includes(key)))throw new TypeError('Browser CAD replacement meshes require kind cad and only positions, faceIds, kind, sourceHash.');
    if(!Array.isArray(mesh.positions)||!mesh.positions.every(value=>typeof value==='number'&&Number.isFinite(value)&&Math.fround(value)===value))throw new TypeError('Browser CAD replacement positions must be exact finite Float32 values; no silent rounding is allowed.');
    if(Object.hasOwn(mesh,'sourceHash')&&(typeof mesh.sourceHash!=='string'||mesh.sourceHash.length===0))throw new TypeError('Browser CAD replacement sourceHash must be a nonempty string when present.');
  }
}

/** Versioned CAD transactions. loadProject must commit synchronously and atomically. */
export function createCadUpdateOperations({studio,isBusy=()=>false,validateReplacement=()=>{}}){
  if(typeof studio?.exportProject!=='function'||typeof studio?.loadProject!=='function')throw new TypeError('CAD updates require a studio adapter.');
  const check=guard=>{if(!guard())throw Error('CAD update permission expired.');if(isBusy())throw Error('Studio is busy.');};
  async function prepare(args,guard){
    check(guard);
    if(!revision(args?.expectedRevision))throw new TypeError('expectedRevision must be a SHA-256 revision.');
    const expectedRevision=args.expectedRevision;
    // The live studio export may contain optional undefined properties. Revision the
    // same JSON representation that a client receives, not internal object details.
    const input=snapshot(studio.exportProject()),source=canonicalJson(input);
    canonicalJson(args.replacement);
    const replacement=structuredClone(args.replacement);
    validateReplacement(replacement);
    const [inputRevision,replacementRevision]=await Promise.all([getProjectRevision(input),getProjectRevision(replacement)]);
    check(guard);
    if(expectedRevision!==inputRevision)throw Error('Project revision conflict.');
    if(canonicalJson(snapshot(studio.exportProject()))!==source)throw Error('Project changed during CAD update.');
    const plan=planCadUpdate(input,replacement);
    return {source,inputRevision,replacementRevision,plan};
  }
  function unchanged(source,guard){check(guard);if(canonicalJson(snapshot(studio.exportProject()))!==source)throw Error('Project changed during CAD update.');}
  function summary(tx,offset=0,limit=50){return {schemaVersion:1,inputRevision:tx.inputRevision,replacementRevision:tx.replacementRevision,
    matched:tx.plan.matched,pending:tx.plan.pending,reportCount:tx.plan.reports.length,offset,limit,reports:page(tx.plan.reports,offset,limit)};}
  return {
    async preview(args){
      const {offset=0,limit=50}=args??{};
      if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>50)throw new TypeError('Invalid CAD report page: offset >= 0 and limit 1..50 required.');
      const tx=await prepare(args,()=>true);
      unchanged(tx.source,()=>true);
      return summary(tx,offset,limit);
    },
    async apply(args,{guard=()=>true}={}){
      if(!revision(args?.expectedReplacementRevision))throw new TypeError('expectedReplacementRevision must be a SHA-256 revision.');
      const expectedReplacementRevision=args.expectedReplacementRevision;
      const tx=await prepare(args,guard);
      if(expectedReplacementRevision!==tx.replacementRevision)throw Error('Replacement revision conflict.');
      const output=snapshot(tx.plan.project),nextRevision=await getProjectRevision(output);
      unchanged(tx.source,guard);
      studio.loadProject(output);
      return {...summary(tx),previousRevision:tx.inputRevision,revision:nextRevision};
    }
  };
}
