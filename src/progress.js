import {validatePublicationMilestone} from './publication-milestone.js';
export const statusNames=['queued','building','checking','fixing','ready','released'];
function validateReview(review){
 if(review===undefined)return;
 const allowed=['status','pr','head','instruction','summary','summaryEn'];
 if(!review||typeof review!=='object'||Array.isArray(review)||Object.keys(review).some(k=>!allowed.includes(k))||!['merged','changes-required'].includes(review.status)||!Number.isSafeInteger(review.pr)||review.pr<1||review.pr>1000000000||!/^[a-f0-9]{40}$/.test(review.head)||!['summary','summaryEn'].every(k=>typeof review[k]==='string'&&review[k].length>0&&review[k].length<=2000))throw Error('Invalid task review');
 if(review.instruction!==undefined&&(typeof review.instruction!=='string'||!/^docs\/opencode-work-orders-\d{4}-\d{2}-\d{2}\/\d{2}-[A-Za-z0-9-]+\.md$/.test(review.instruction)))throw Error('Invalid review instruction path');
 if(review.status==='changes-required'&&!review.instruction)throw Error('Missing review instruction');
}
export function validateProgress(p){
 if(p?.version!==1||!Array.isArray(p.tasks)||!p.release||!Array.isArray(p.solvers)||!Number.isFinite(Date.parse(p.updatedAt)))throw Error('進捗データが不正です。');
 if(p.release.testCount!==undefined&&(!Number.isInteger(p.release.testCount)||p.release.testCount<1||p.release.testCount>100000))throw Error('Invalid progress test count');const ids=new Set();for(const t of p.tasks){if(typeof t.id!=='string'||ids.has(t.id)||!statusNames.includes(t.status)||typeof t.title!=='string'||typeof t.detail!=='string'||typeof t.category!=='string')throw Error('作業データが不正です。');validateReview(t.review);if(t.review?.status==='changes-required'&&t.status==='released')throw Error('Unresolved review cannot be released');ids.add(t.id);if(t.status==='released'&&!t.evidence)throw Error('公開済み作業の証跡がありません。');}
 for(const t of p.tasks)for(const d of t.depends||[])if(!ids.has(d)||d===t.id)throw Error('依存関係が不正です。');
 // depends is prerequisite-only: a released task cannot precede an unreleased prerequisite. Umbrella membership uses parents; non-blocking links use related.
 for(const t of p.tasks){for(const k of ['parents','related'])if(t[k]!==undefined&&(!Array.isArray(t[k])||t[k].some(d=>!ids.has(d)||d===t.id)))throw Error('関連付けが不正です。');if(t.status==='released')for(const d of t.depends||[])if(p.tasks.find(x=>x.id===d).status!=='released')throw Error(`公開済み${t.id}の前提${d}が未公開です。`);}
 const visiting=new Set(),done=new Set(),map=new Map(p.tasks.map(t=>[t.id,t]));function visit(id){if(visiting.has(id))throw Error('依存関係が循環しています。');if(done.has(id))return;visiting.add(id);for(const d of map.get(id).depends||[])visit(d);visiting.delete(id);done.add(id);}for(const id of ids)visit(id);
 validatePublicationMilestone(p.publicationMilestone,ids);
 return p;
}
