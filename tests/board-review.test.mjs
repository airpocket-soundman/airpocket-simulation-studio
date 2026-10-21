import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the board entry point's actual rendering functions without its eager
// CSS import, network refresh and page bootstrap. No duplicate review renderer.
const source=readFileSync(new URL('../src/board.js',import.meta.url),'utf8');
function element(tag,text,cls){return {tag,textContent:text??'',className:cls,children:[],style:{setProperty(){}},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=[...children];}};}
function all(root,tag){return [...(root.tag===tag?[root]:[]),...root.children.flatMap(child=>all(child,tag))];}
const text=root=>[root.textContent,...root.children.map(text)].join(' ');
function fixture(tasks){
 const roots={columns:element('div'),'filtered-count':element('span')},entries={};
 const context=vm.createContext({tasks,publication:null,repo:'https://github.com/airpocket-soundman/airpocket-simulation-studio',node:element,$:id=>roots[id],stages:[['building','つくっている','実装中'],['fixing','直している','修正中']],colors:['a','b'],category:'all',query:'',reviewFilter:'all',release:{version:'test'},addTranslations:map=>Object.assign(entries,map),detail:()=>{}});
 const helpers=source.slice(source.indexOf('// Review counts describe'),source.indexOf('function detail(t)'));
 const columns=source.slice(source.indexOf('function columns()'),source.indexOf('function panel()'));
 const translations=source.slice(source.indexOf('function taskTranslations()'),source.indexOf("addTranslations({'PRレビュー'"));
 vm.runInContext(helpers+columns+translations,context);
 const run=(code)=>vm.runInContext(code,context);
 return {context,roots,entries,run};
}
const task=(id,status,review)=>({id,status,title:id,titleEn:id,detail:'Detail',detailEn:'Detail',category:'UI',...(review?{review}:{})});
const review=(status,pr,extra={})=>({status,pr,summary:'入力を確認 <script>synthetic</script>',summaryEn:'Check input <script>synthetic</script>',...extra});

test('review counts are derived separately from parent stages and recomputed after replacement',()=>{
 const tasks=[...Array.from({length:11},(_,i)=>task('GOOD'+i,'building',review('merged',126+i))),...Array.from({length:9},(_,i)=>task('FIX'+i,'fixing',review('changes-required',137+i))),task('OTHER','building')],before=JSON.stringify(tasks),f=fixture(tasks);
 assert.equal(JSON.stringify(f.run('reviewCounts(tasks)')),JSON.stringify({total:20,merged:11,changesRequired:9}));
 f.context.root=element('section');f.run('renderReviewSummary(root)');
 assert.deepEqual(all(f.context.root,'dd').map(n=>n.textContent),['20','11','9']);
 assert.match(text(f.context.root),/親タスク全体の完了を意味しません/);
 assert.equal(JSON.stringify(tasks),before);
 f.context.tasks=[task('NEW','building',review('merged',200)),task('NEWFIX','fixing',review('changes-required',201))];
 f.run('renderReviewSummary(root)');assert.deepEqual(all(f.context.root,'dd').map(n=>n.textContent),['2','1','1']);
});

test('actual columns combine review filter, category and review search without changing counts or stages',()=>{
 const f=fixture([task('A','building',review('merged',126)),task('B','fixing',review('changes-required',145)),task('C','building')]);
 f.context.reviewFilter='changes-required';f.context.query='PR #145';f.run('columns()');
 assert.equal(f.roots['filtered-count'].textContent,'1 件');assert.equal(all(f.roots.columns,'button').length,1);
 assert.match(text(f.roots.columns),/要修正 · PR #145/);assert.ok(!text(f.roots.columns).includes('取り込み · PR #126'));
 f.context.category='CAD';f.run('columns()');assert.equal(f.roots['filtered-count'].textContent,'0 件');
 f.context.category='all';f.context.query='';f.context.reviewFilter='unreviewed';f.run('columns()');
 assert.equal(all(f.roots.columns,'button')[0].children[0].textContent,'C');
 f.context.reviewFilter='merged';f.run('columns()');assert.match(text(f.roots.columns),/取り込み · PR #126/);
 f.context.reviewFilter='all';f.run('columns()');assert.equal(f.roots['filtered-count'].textContent,'3 件');
});

test('review detail uses literal text and fixed repository links, rejecting paths and PR injection',()=>{
 const path='docs/opencode-work-orders-2026-10-21/40-AGENTCHAT1.md',f=fixture([]);f.context.root=element('div');f.context.t=task('FIX','fixing',review('changes-required',145,{instruction:path}));
 f.run('appendReviewDetails(root,t)');const links=all(f.context.root,'a');
 assert.equal(links[0].href,'https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/145');
 assert.equal(links[1].href,'https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/main/'+path);
 assert.equal(links[1].rel,'noopener noreferrer');assert.equal(links[1].target,'_blank');
 assert.match(text(f.context.root),/<script>synthetic<\/script>/);assert.equal(all(f.context.root,'script').length,0);
 for(const instruction of ['javascript:alert(1)','https://evil.invalid/a','../a.md','docs/opencode-work-orders-2026-10-21/../../a.md','docs/opencode-work-orders-2026-10-21/%2e%2e.md']){
  f.context.root=element('div');f.context.t.review.instruction=instruction;f.run('appendReviewDetails(root,t)');assert.equal(all(f.context.root,'a').length,1);
 }
 f.context.root=element('div');f.context.t.review.pr='145/../../evil';f.run('appendReviewDetails(root,t)');assert.equal(all(f.context.root,'a').length,0);
 f.context.root=element('div');f.context.t=task('OK','building',review('merged',126,{instruction:path}));f.run('appendReviewDetails(root,t)');assert.equal(all(f.context.root,'a').length,1);
});

test('new review text remains Japanese source with registered English translations, including refreshed summaries',()=>{
 const t=task('FIX','fixing',review('changes-required',145)),f=fixture([t]);f.run('taskTranslations()');
 assert.equal(f.entries[t.review.summary],t.review.summaryEn);
 assert.equal(f.entries['要修正 · PR #145'],'Changes required · PR #145');
 assert.equal(f.run('reviewBadge(tasks[0])').textContent,'要修正 · PR #145');
 f.context.tasks=[task('OK','building',review('merged',126))];f.run('taskTranslations()');
 assert.equal(f.entries['取り込み · PR #126'],'Merged · PR #126');
 assert.ok(source.includes('aria-label="レビューで絞り込む"'));
 assert.ok(source.includes('renderReviewSummary($(\'review-summary\'))'));
});
