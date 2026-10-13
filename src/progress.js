export const statusNames=['queued','building','checking','fixing','ready','released'];
export function validateProgress(p){
 if(p?.version!==1||!Array.isArray(p.tasks)||!p.release||!Array.isArray(p.solvers)||!Number.isFinite(Date.parse(p.updatedAt)))throw Error('進捗データが不正です。');
 if(p.release.testCount!==undefined&&(!Number.isInteger(p.release.testCount)||p.release.testCount<1||p.release.testCount>100000))throw Error('Invalid progress test count');const ids=new Set();for(const t of p.tasks){if(typeof t.id!=='string'||ids.has(t.id)||!statusNames.includes(t.status)||typeof t.title!=='string'||typeof t.detail!=='string'||typeof t.category!=='string')throw Error('作業データが不正です。');ids.add(t.id);if(t.status==='released'&&!t.evidence)throw Error('公開済み作業の証跡がありません。');}
 for(const t of p.tasks)for(const d of t.depends||[])if(!ids.has(d)||d===t.id)throw Error('依存関係が不正です。');
 const visiting=new Set(),done=new Set(),map=new Map(p.tasks.map(t=>[t.id,t]));function visit(id){if(visiting.has(id))throw Error('依存関係が循環しています。');if(done.has(id))return;visiting.add(id);for(const d of map.get(id).depends||[])visit(d);visiting.delete(id);done.add(id);}for(const id of ids)visit(id);
 return p;
}
