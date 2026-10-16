import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
// Detects stale GUI references only: every `#id`, `[data-x="y"]` and `tag.class` token cited in the GUI column must
// still be defined as a literal in the page-building sources. It does not verify the same-path/related classification.
const sourceFiles=['index.html','src/main.js',...readdirSync('src/ui').map(f=>'src/ui/'+f),...readdirSync('src').filter(f=>/-ui\.js$|^visual-export\.js$/.test(f)).map(f=>'src/'+f)];
const source=sourceFiles.map(f=>readFileSync(f,'utf8')).join('\n');
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Element definitions: id="x" / id='x' / .id='x' / .id="x" in markup or DOM code, or a helper call field('x',...).
const hasId=id=>new RegExp('(?:\\bid\\s*=\\s*[\'"]'+escape(id)+'[\'"]|\\.id\\s*=\\s*[\'"]'+escape(id)+'[\'"]|\\bfield\\(\\s*[\'"]'+escape(id)+'[\'"]|\\bel\\(\\s*[\'"][A-Za-z0-9]+[\'"]\\s*,\\s*[\'"]'+escape(id)+'[\'"])').test(source);
const guiCells=file=>readFileSync(file,'utf8').split('\n').filter(l=>l.startsWith('| `')).map(l=>({name:l.split('|')[1].trim(),cell:l.split('|')[4]}));
const tokens=cell=>[...cell.matchAll(/`([^`]+)`/g)].map(m=>m[1]);
for(const file of ['docs/operation-correspondence.md','docs/en/operation-correspondence.md'])test('every GUI element cited in the correspondence table exists in the source: '+file,()=>{
 const rows=guiCells(file);
 assert.ok(rows.length>=121);
 let checked=0;
 for(const {name,cell} of rows)for(const token of tokens(cell)){
  let m;
  if(token.startsWith('#')){assert.ok(/^#[A-Za-z][\w-]*$/.test(token),name+': malformed id '+token);assert.ok(hasId(token.slice(1)),name+': id not found in source: '+token);checked++;}
  else if((m=/^\[data-([a-z-]+)="([^"]+)"\]$/.exec(token))){assert.ok(source.includes('data-'+m[1]+'="'+m[2]+'"'),name+': data attribute not found in source: '+token);checked++;}
  else if((m=/^([a-z]+)\.([a-z-]+)$/.exec(token))){assert.ok(source.includes('class="'+m[2]+'"'),name+': class not found in source: '+token);checked++;}
 }
 assert.ok(checked>=100,'expected many GUI references, saw '+checked);
});
test('GUI column uses one of the three classifications and never the old name-search wording',()=>{
 for(const file of ['docs/operation-correspondence.md','docs/en/operation-correspondence.md'])for(const {name,cell} of guiCells(file)){
  const text=cell.trim();
  assert.ok(/^(same path:|同一経路:|related, not the same operation:|関連（別処理）:|connector only — no GUI control by design)/.test(text),name+': unclassified GUI cell');
  assert.ok(!/^no GUI control/.test(text),name+': stale wording');
 }
});
test('connector-only rows cite no control id as their own GUI path',()=>{
 // A connector-only cell may mention an id only inside its parenthetical explanation, never as a leading control list.
 for(const file of ['docs/operation-correspondence.md','docs/en/operation-correspondence.md'])for(const {name,cell} of guiCells(file)){
  const text=cell.trim();if(!text.startsWith('connector only'))continue;
  assert.ok(text.startsWith('connector only — no GUI control by design')&&!/^connector only — no GUI control by design\s+`/.test(text),name);
 }
});
