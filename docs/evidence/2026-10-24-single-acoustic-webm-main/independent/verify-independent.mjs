// Prepared audit only. Run after root explicitly releases the one captured artifact.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
if(process.argv[2]!=='--artifact-ready')throw Error('Artifact readiness and decode budget must be confirmed by root before execution');
const config=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),out=path.resolve(config.outputDirectory);fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const status=read(config.statusFile),manifest=status.artifact?.manifest??status.status?.artifact?.manifest??status.manifest;assert.ok(manifest,'Map actual status schema explicitly');
const bytes=fs.readFileSync(config.artifactFile);assert.equal(bytes.length,manifest.totalBytes);assert.equal('sha256:'+sha(bytes),manifest.sha256);
const times=read(config.storedTimesFile);assert.ok(Array.isArray(times)&&times.length>=2);assert.equal(times.at(-1),.0012);
const entries=manifest.time.frameTimings;assert.equal(entries.length,48);
const total=2000000n,n=48n,round=i=>Number((BigInt(i)*total*2n+n)/(2n*n));
for(let i=0;i<48;i++){
 const e=entries[i],requested=i===47?times.at(-1):times[0]+(times.at(-1)-times[0])*i/47;let nearest=0;
 for(let j=1;j<times.length;j++)if(Math.abs(times[j]-requested)<Math.abs(times[nearest]-requested))nearest=j;
 assert.equal(e.index,i);assert.equal(e.timestampMicroseconds,round(i));assert.equal(e.durationMicroseconds,round(i+1)-round(i));assert.equal(e.snapshotIndex,nearest);assert.ok(Math.abs(e.requestedTimeSeconds-requested)<1e-15);assert.equal(e.actualTimeSeconds,times[nearest]);assert.equal(e.offsetSeconds,e.actualTimeSeconds-e.requestedTimeSeconds);
}
assert.equal(entries.at(-1).actualTimeSeconds,.0012);assert.equal(entries.at(-1).offsetSeconds,0);
const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_streams','-show_frames','-show_format','-of','json',config.artifactFile],{windowsHide:true,maxBuffer:8*1024*1024}));
fs.writeFileSync(path.join(out,'ffprobe-independent.json'),JSON.stringify(probe,null,2)+'\n');assert.equal(probe.streams.length,1);assert.equal(probe.streams[0].codec_name,'vp8');assert.equal(probe.frames.length,48);assert.equal(Number(probe.format.duration),2);assert.equal(probe.streams[0].width,manifest.resolution.width);assert.equal(probe.streams[0].height,manifest.resolution.height);
for(let i=0;i<48;i++){assert.equal(probe.frames[i].key_frame,1);assert.equal(Math.round(Number(probe.frames[i].pts_time)*1e6),round(i));}
const decoded=execFileSync('ffmpeg',['-v','error','-i',config.artifactFile,'-map','0:v:0','-f','framehash','-hash','sha256','-'],{windowsHide:true,maxBuffer:4*1024*1024}).toString();fs.writeFileSync(path.join(out,'decoded-framehash-independent.txt'),decoded);
const rows=decoded.split(/\r?\n/).filter(l=>l&&!l.startsWith('#'));assert.equal(rows.length,48);
const state=read(config.stateFile);for(const k of ['cases','compare','result','view'])assert.deepEqual(state.after[k],state.before[k]);const b=structuredClone(state.before.inspect),a=structuredClone(state.after.inspect);delete a.lifecycle;delete b.lifecycle;assert.deepEqual(a,b);
const result={artifactBytes:bytes.length,artifactSha256:sha(bytes),frames:48,panels:1,codec:'vp8',durationSeconds:2,terminalPhysicalTimeSeconds:.0012,terminalOffsetSeconds:0,physicalStatesEqual:5,firstDecodedSha256:rows[0].split(',').at(-1).trim(),lastDecodedSha256:rows.at(-1).split(',').at(-1).trim(),extraExports:0,solverRuns:0};fs.writeFileSync(path.join(out,'independent-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
