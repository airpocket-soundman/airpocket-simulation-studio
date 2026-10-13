const keys=['youngModulus','density','strength','poissonRatio'];
export function validateCatalogSelection(selection,properties){
 if(selection===undefined)return;
 const s=selection,text=v=>typeof v==='string'&&v.length>0&&v.length<=2000;
 if(!s||s.version!==1||!text(s.id)||!text(s.catalogVersion)||!text(s.grade)||!text(s.manufacturer)||!text(s.polymer)||!text(s.source?.url)||!s.source.url.startsWith('https://')||!text(s.source.revision)||!text(s.source.retrievedAt)||s.source.sha256!==null&&!/^[a-f0-9]{64}$/.test(s.source.sha256)||!['manufacturer-tds','experimental'].includes(s.kind)||s.approximation!=='isotropic-linear'||s.poissonRatioOrigin!=='user-assumption'||!s.appliedProperties||!s.overrides||typeof s.overrides!=='object'||Array.isArray(s.overrides))throw Error('Invalid material catalog provenance');
 const finiteOrNull=v=>v===null||Number.isFinite(v);
 for(const key of keys){if(!finiteOrNull(s.appliedProperties[key]))throw Error('Invalid catalog property snapshot');const value=properties[key]??null,original=s.appliedProperties[key];if(value!==original){if(!Object.hasOwn(s.overrides,key)||s.overrides[key]!==value)throw Error('Changed catalog properties require recorded overrides');}else if(Object.hasOwn(s.overrides,key))throw Error('Invalid redundant catalog override');}
 if(Object.keys(s.overrides).some(key=>!keys.includes(key)))throw Error('Unknown catalog override');
 if(!Number.isFinite(s.appliedProperties.poissonRatio)||s.appliedProperties.poissonRatio<=-1||s.appliedProperties.poissonRatio>=.5||keys.filter(k=>k!=='poissonRatio').some(k=>s.appliedProperties[k]!==null&&s.appliedProperties[k]<=0)||!s.filler||!['unfilled','glassFiber','longGlassFiber','glassBead','talc'].includes(s.filler.type)||!Number.isFinite(s.filler.contentPercent)||s.filler.contentPercent<0||s.filler.contentPercent>100||!['none','not-stated','weight-percent'].includes(s.filler.basis)||(s.filler.type==='unfilled')!==(s.filler.contentPercent===0))throw Error('Invalid catalog assumptions or filler');
}
export function reconcileCatalogEdits(selection,properties){
 if(!selection)return undefined;const result=structuredClone(selection);result.overrides={};for(const key of keys){const value=properties[key]??null;if(value!==result.appliedProperties[key])result.overrides[key]=value;}return result;
}
