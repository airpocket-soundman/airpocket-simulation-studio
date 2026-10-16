import {readFile,writeFile} from 'node:fs/promises';
import {collectProgressHistory,serializeProgressHistory} from './progress-history.mjs';

// PROGRESS_HISTORY_REQUIRE_COMPLETE=1 (set in CI) fails a shallow or over-long checkout
// instead of publishing a history that declares itself incomplete.
const root=new URL('../dist/',import.meta.url),requireComplete=process.env.PROGRESS_HISTORY_REQUIRE_COMPLETE==='1';
const built=await readFile(new URL('progress.json',root));
const history=await collectProgressHistory({requireComplete,progressBytes:built}),bytes=serializeProgressHistory(history);
await writeFile(new URL('progress-history.json',root),bytes);
const c=history.completeness;
console.log('Progress history: '+c.pointCount+' points, '+c.skippedCount+' skipped, '+(c.shallow?'SHALLOW, ':'')+(c.truncated?'TRUNCATED, ':'')+bytes.length+' bytes');
