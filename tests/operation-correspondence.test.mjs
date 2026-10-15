import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {browserMethods} from '../src/browser-operation-names.js';
// MCP tool names are declared as {name:'studio_*'} literals in the server source (default list plus the two browser-connection tools).
const tools=[...readFileSync('scripts/studio-mcp.mjs','utf8').matchAll(/\{name:'(studio_[a-z_0-9]+)'/g)].map(m=>m[1]);
const rowsOf=(text)=>text.split('\n').filter(l=>l.startsWith('| `')).map(l=>l.split('|')[1].trim());
for(const file of ['docs/operation-correspondence.md','docs/en/operation-correspondence.md'])test('operation correspondence table lists every browser method and MCP tool exactly once: '+file,()=>{
 const rows=rowsOf(readFileSync(file,'utf8'));
 const methods=Object.keys(browserMethods);
 assert.equal(new Set(tools).size,tools.length);assert.ok(tools.length>=33);assert.ok(methods.length>=88);
 for(const name of [...methods,...tools])assert.equal(rows.filter(r=>r==='`'+name+'`').length,1,name);
 assert.equal(rows.length,methods.length+tools.length,'no unknown rows');
 for(const line of readFileSync(file,'utf8').split('\n').filter(l=>l.startsWith('| `')))assert.equal(line.split('|').length,7,line);
});
test('operation correspondence docs are linked from API coverage',()=>{
 assert.ok(readFileSync('docs/api-coverage.md','utf8').includes('operation-correspondence.md'));
 assert.ok(readFileSync('docs/en/api-coverage.md','utf8').includes('operation-correspondence.md'));
});
