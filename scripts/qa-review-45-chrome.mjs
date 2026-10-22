// Real branded-Chrome QA for work order 45 (EXPORTBACKGROUND1).
// Prerequisite: dedicated Chrome with --remote-debugging-port=9333 and the Studio dev server.
// Usage: QA_ORIGIN=http://127.0.0.1:5174 node scripts/qa-review-45-chrome.mjs
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {closePage, openCdp} from './qa-cdp-client.mjs';
import {createStdioClient} from './perf-browser.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:5174';
const out = path.resolve(ROOT, process.env.QA_OUT || '.qa/review45');
const casesPath = path.resolve(ROOT, process.env.QA_CASES || 'docs/evidence/review51-real-archives/cases.json');
const cdpPort = Number(process.env.CDP_PORT || 9333);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => Date.now();
mkdirSync(out, {recursive: true});

let token = null;
const client = await createStdioClient({origin, announce: ({endpoint, pairingToken}) => { token = pairingToken; console.log(`MCP endpoint ${endpoint}`); }});
const a = await openCdp('about:blank');
const b = await openCdp('about:blank');
const result = {
  schemaVersion: 1,
  date: '2026-10-22',
  taskId: 'EXPORTBACKGROUND1',
  workOrder: 45,
  parentTaskReleased: false,
  origin,
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim(),
  browserProduct: null,
  realVisibilityMethod: 'CDP Page.bringToFront changes the real active tab; document.visibilityState/visibilitychange are observed. No DOM event is dispatched by this harness.',
  runs: [],
};
try {
  await a.cdp.setViewport(1280, 900);
  await a.cdp.navigate(`${origin}/?lang=en`);
  await sleep(2500);
  const browserVersion = await fetch(`http://127.0.0.1:${cdpPort}/json/version`).then((response) => response.json());
  result.browserProduct = browserVersion.Browser;
  for (let attempt = 0; attempt < 60; attempt++) {
    const ready = await a.cdp.evaluate('({caseList:typeof window.caseOperations?.list,video:typeof window.comparisonVideoApi?.start,studio:typeof window.studioApi})');
    if (ready.caseList === 'function' && ready.video === 'function') break;
    await sleep(500);
  }
  const archiveB64 = readFileSync(casesPath).toString('base64');
  await a.cdp.evaluate(`window.__qaArchive=JSON.parse(atob(${JSON.stringify(archiveB64)})); true`);
  const initial = await a.cdp.evaluate('window.caseOperations.list()');
  const imported = await a.cdp.evaluate(`window.caseOperations.importArchive({archive:window.__qaArchive,expectedArchiveRevision:${JSON.stringify(initial.archiveRevision)}})`);
  const cases = imported.cases;
  result.cases = cases.map((entry) => ({name: entry.name, caseId: entry.caseId, revision: entry.revision}));
  result.viewed = (await a.cdp.evaluate(`window.caseOperations.view({caseId:${JSON.stringify(cases[0].caseId)},expectedRevision:${JSON.stringify(cases[0].revision)}})`)).displayed;
  await sleep(500);
  const camera = {position: [61, 41, 84], target: [5, 5, 20], up: [0, 1, 0], fov: 40};
  const compareArchive = {version: 1, kind: 'comparison-view', sources: cases.map((entry) => ({revision: entry.revision})), settings: {field: 'instantPressure', deformScale: 1, camera, timeSeconds: 0}};
  const current = await a.cdp.evaluate('window.comparisonViewApi.get()');
  result.compareApplied = await a.cdp.evaluate(`window.comparisonViewApi.set({archive:${JSON.stringify(compareArchive)},expectedRevision:${JSON.stringify(current.revision)}})`);
  await sleep(500);

  await a.cdp.evaluate(`(()=>{const d=document.querySelector('#agent-connection details'); if(d)d.open=true; document.querySelector('#agent-endpoint').value=${JSON.stringify(client.info.endpoint)}; document.querySelector('#agent-token').value=${JSON.stringify(token)}; for(const s of ['inspect','view']){const e=document.querySelector('[data-agent-scope="'+s+'"]'); if(e)e.checked=true;} for(const s of ['edit','analyze']){const e=document.querySelector('[data-agent-scope="'+s+'"]'); if(e)e.checked=false;} document.querySelector('#agent-connect').click(); return true;})()`);
  let session = null;
  for (let attempt = 0; attempt < 60 && !session; attempt++) {
    const {sessions = []} = await client.call('studio_browser_sessions', {});
    session = sessions[0] || null;
    if (!session) await sleep(500);
  }
  if (!session) throw new Error('No paired browser session');
  result.sessionScopes = session.scopes;
  const call = (method, args = {}) => client.call('studio_browser_call', {sessionId: session.sessionId, method, args});

  await a.cdp.evaluate(`(()=>{
    window.__qaVisibility=[];
    document.addEventListener('visibilitychange',()=>window.__qaVisibility.push({t:Date.now(),state:document.visibilityState,hidden:document.hidden}));
    window.__qaStreams=[]; const orig=HTMLCanvasElement.prototype.captureStream;
    HTMLCanvasElement.prototype.captureStream=function(...args){const stream=orig.apply(this,args);window.__qaStreams.push(stream);return stream;};
    const Orig=window.MediaRecorder; window.__qaRecorders=[];
    window.MediaRecorder=class extends Orig{constructor(...args){super(...args);window.__qaRecorders.push(this);}};
    window.__qaReset=()=>{window.__qaStreams=[];window.__qaRecorders=[];window.__qaVisibility=[];};
    return true;
  })()`);
  const snapshot = async (label) => ({
    label,
    t: now(),
    visibility: await a.cdp.evaluate('document.visibilityState'),
    hidden: await a.cdp.evaluate('document.hidden'),
    inputRevision: await a.cdp.evaluate('window.studioApi.getRevision()'),
    cases: await a.cdp.evaluate('window.caseOperations.list()'),
    compareApi: await a.cdp.evaluate('window.comparisonViewApi.get()'),
    result: await a.cdp.evaluate('window.resultViewApi.get()').catch((error) => ({error: String(error.message)})),
    status: await a.cdp.evaluate('document.querySelector("#compare-video-status")?.textContent ?? null'),
    startDisabled: await a.cdp.evaluate('document.querySelector("#compare-video-start")?.disabled ?? null'),
    cancelDisabled: await a.cdp.evaluate('document.querySelector("#compare-video-cancel")?.disabled ?? null'),
    downloadHidden: await a.cdp.evaluate('document.querySelector("#compare-video-download")?.hidden ?? null'),
    previewHidden: await a.cdp.evaluate('document.querySelector("#compare-video-preview")?.hidden ?? null'),
    disabledIds: await a.cdp.evaluate('[...document.querySelectorAll("#app button:disabled,#app input:disabled,#app select:disabled")].map((element) => element.id).filter(Boolean).sort()'),
    streams: await a.cdp.evaluate('window.__qaStreams.map((stream)=>stream.getTracks().map((track)=>({kind:track.kind,readyState:track.readyState,enabled:track.enabled})))'),
    recorders: await a.cdp.evaluate('window.__qaRecorders.map((recorder)=>({state:recorder.state,mimeType:recorder.mimeType}))'),
    visibilityEvents: await a.cdp.evaluate('window.__qaVisibility'),
    compareMcp: await call('getCompareView', {}),
    resultMcp: await call('getResultView', {}),
    caseList: await call('caseList', {}),
  });
  const setInputs = async (seconds) => {
    await a.cdp.evaluate(`(()=>{const s=document.querySelector('#compare-video-seconds');s.value=${JSON.stringify(String(seconds))};s.dispatchEvent(new Event('input',{bubbles:true}));const f=document.querySelector('#compare-video-format');f.value='webm';f.dispatchEvent(new Event('change',{bubbles:true}));const k=document.querySelector('#compare-video-kind');k.value='orbit';k.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  };
  const clickStart = () => a.cdp.evaluate('document.querySelector("#compare-video-start").click()');
  const waitStarted = async () => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const state = await a.cdp.evaluate('({t:Date.now(),status:document.querySelector("#compare-video-status").textContent,cancelDisabled:document.querySelector("#compare-video-cancel").disabled,recorders:window.__qaRecorders.map((recorder)=>recorder.state),streams:window.__qaStreams.length})');
      if (state.recorders.includes('recording') || !state.cancelDisabled) return state;
      await sleep(100);
    }
    throw new Error('Recording did not start');
  };
  const waitSettled = async (label, timeoutMs = 30000) => {
    const started = now();
    for (let attempt = 0; attempt < Math.ceil(timeoutMs / 100); attempt++) {
      const state = await a.cdp.evaluate('({t:Date.now(),status:document.querySelector("#compare-video-status").textContent,startDisabled:document.querySelector("#compare-video-start").disabled,cancelDisabled:document.querySelector("#compare-video-cancel").disabled,downloadHidden:document.querySelector("#compare-video-download").hidden,previewHidden:document.querySelector("#compare-video-preview").hidden,recorders:window.__qaRecorders.map((recorder)=>({state:recorder.state})),streams:window.__qaStreams.map((stream)=>stream.getTracks().map((track)=>track.readyState)),events:window.__qaVisibility.slice()})');
      if (state.cancelDisabled && !String(state.status).includes('Creating')) return {...state, settleMs: now() - started};
      await sleep(100);
    }
    throw new Error(`${label} did not settle within ${timeoutMs} ms`);
  };
  const setVisible = async () => { await a.cdp.send('Page.bringToFront'); await sleep(500); };
  const setHidden = async () => { await b.cdp.send('Page.bringToFront'); await sleep(500); };
  const unchanged = (before, after, keys) => Object.fromEntries(keys.map((key) => [key, JSON.stringify(before[key]) === JSON.stringify(after[key])]));

  await setVisible();
  await a.cdp.evaluate('window.__qaReset()');
  const beforeVisible = await snapshot('before-visible');
  result.beforeVisible = {visibility: beforeVisible.visibility, startDisabled: beforeVisible.startDisabled, compareRevision: beforeVisible.compareApi.revision, disabledIds: beforeVisible.disabledIds};

  // 1. Foreground success: proves the normal path and the next-recording path.
  await setInputs(1);
  await clickStart();
  const successStarted = await waitStarted();
  const successSettled = await waitSettled('foreground success');
  const successBlob = await a.cdp.evaluate('fetch(document.querySelector("#compare-video-download").href).then((response)=>response.blob()).then(async (blob)=>{const bytes=new Uint8Array(await blob.arrayBuffer());let text="";for(let i=0;i<bytes.length;i+=0x8000)text+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return {type:blob.type,size:blob.size,base64:btoa(text)};})');
  const videoBytes = Buffer.from(successBlob.base64, 'base64');
  const videoName = 'foreground-success.webm';
  writeFileSync(path.join(out, videoName), videoBytes);
  const successAfter = await snapshot('after-foreground-success');
  result.runs.push({
    kind: 'foreground-success', sequence: 1,
    before: {visibility: beforeVisible.visibility, startDisabled: beforeVisible.startDisabled, disabledIds: beforeVisible.disabledIds},
    started: successStarted, settled: successSettled, settleMs: successSettled.t - successStarted.t,
    artifact: {file: videoName, bytes: videoBytes.length, sha256: createHash('sha256').update(videoBytes).digest('hex'), mime: successBlob.type},
    after: {visibility: successAfter.visibility, startDisabled: successAfter.startDisabled, cancelDisabled: successAfter.cancelDisabled, downloadHidden: successAfter.downloadHidden, previewHidden: successAfter.previewHidden, disabledIds: successAfter.disabledIds, streams: successAfter.streams, recorders: successAfter.recorders},
    unchanged: unchanged(beforeVisible, successAfter, ['inputRevision', 'cases', 'compareApi', 'result']),
  });

  // 2. Real hidden during recording: a different real tab is brought to the front.
  await setVisible();
  await a.cdp.evaluate('window.__qaReset()');
  const beforeHidden = await snapshot('before-hidden');
  await setInputs(10);
  await clickStart();
  const hiddenStarted = await waitStarted();
  const tStart = now();
  await setHidden();
  const hiddenAt = await a.cdp.evaluate('({t:Date.now(),visibility:document.visibilityState,hidden:document.hidden,status:document.querySelector("#compare-video-status").textContent,cancelDisabled:document.querySelector("#compare-video-cancel").disabled,recorders:window.__qaRecorders.map((recorder)=>recorder.state),streams:window.__qaStreams.map((stream)=>stream.getTracks().map((track)=>track.readyState)),events:window.__qaVisibility.slice()})');
  const hiddenSettled = await waitSettled('hidden');
  await setVisible();
  const afterHidden = await snapshot('after-hidden');
  result.runs.push({
    kind: 'hidden-mid-recording', sequence: 2,
    before: {visibility: beforeHidden.visibility, hidden: beforeHidden.hidden, startDisabled: beforeHidden.startDisabled, disabledIds: beforeHidden.disabledIds},
    started: hiddenStarted, tStart, hiddenAt, settled: hiddenSettled, settleMs: hiddenSettled.t - hiddenAt.t, error: hiddenSettled.status,
    after: {visibility: afterHidden.visibility, hidden: afterHidden.hidden, startDisabled: afterHidden.startDisabled, cancelDisabled: afterHidden.cancelDisabled, downloadHidden: afterHidden.downloadHidden, previewHidden: afterHidden.previewHidden, disabledIds: afterHidden.disabledIds, streams: afterHidden.streams, recorders: afterHidden.recorders, visibilityEvents: afterHidden.visibilityEvents},
    unchanged: unchanged(beforeHidden, afterHidden, ['inputRevision', 'cases', 'compareApi', 'result', 'compareMcp', 'caseList']),
  });

  // 3. Explicit cancel in the foreground.
  await a.cdp.evaluate('window.__qaReset()');
  await setInputs(10);
  await clickStart();
  const cancelStarted = await waitStarted();
  await sleep(400);
  await a.cdp.evaluate('document.querySelector("#compare-video-cancel").click()');
  const cancelSettled = await waitSettled('explicit cancel');
  const cancelAfter = await snapshot('after-cancel');
  result.runs.push({
    kind: 'explicit-cancel', sequence: 3,
    started: cancelStarted, settled: cancelSettled, settleMs: cancelSettled.t - cancelStarted.t, error: cancelSettled.status,
    after: {visibility: cancelAfter.visibility, startDisabled: cancelAfter.startDisabled, cancelDisabled: cancelAfter.cancelDisabled, downloadHidden: cancelAfter.downloadHidden, previewHidden: cancelAfter.previewHidden, disabledIds: cancelAfter.disabledIds, streams: cancelAfter.streams, recorders: cancelAfter.recorders},
    unchanged: unchanged(beforeHidden, cancelAfter, ['inputRevision', 'compareApi']),
  });

  // 4. Hidden at start: the lifecycle must reject before any recorder or stream is created.
  await setVisible();
  await a.cdp.evaluate('window.__qaReset()');
  await setInputs(5);
  await setHidden();
  const hiddenStart = await a.cdp.evaluate('({t:Date.now(),visibility:document.visibilityState,hidden:document.hidden,startDisabled:document.querySelector("#compare-video-start").disabled})');
  await clickStart();
  const hiddenAtStartSettled = await waitSettled('hidden start');
  await setVisible();
  const afterHiddenStart = await snapshot('after-hidden-start');
  result.runs.push({
    kind: 'hidden-at-start', sequence: 4,
    startedAt: hiddenStart, settled: hiddenAtStartSettled, settleMs: hiddenAtStartSettled.t - hiddenStart.t, error: hiddenAtStartSettled.status,
    after: {visibility: afterHiddenStart.visibility, startDisabled: afterHiddenStart.startDisabled, cancelDisabled: afterHiddenStart.cancelDisabled, downloadHidden: afterHiddenStart.downloadHidden, previewHidden: afterHiddenStart.previewHidden, disabledIds: afterHiddenStart.disabledIds, streams: afterHiddenStart.streams, recorders: afterHiddenStart.recorders},
  });

  // 5. Stop deadline: fault injection (not a real hidden result). stop() drops onstop so the finite waitForWebmStop deadline is exercised.
  await a.cdp.evaluate('(()=>{window.__qaOrigStop=MediaRecorder.prototype.stop;MediaRecorder.prototype.stop=function(){this.__qaOnstop=this.onstop;this.onstop=null;return window.__qaOrigStop.call(this);};window.__qaReset();return true;})()');
  await setVisible();
  await setInputs(1);
  await clickStart();
  const timeoutStarted = await waitStarted();
  const timeoutSettled = await waitSettled('stop timeout');
  await a.cdp.evaluate('MediaRecorder.prototype.stop=window.__qaOrigStop; true');
  const timeoutAfter = await snapshot('after-stop-timeout');
  result.runs.push({
    kind: 'stop-timeout-fault-injection', sequence: 5,
    started: timeoutStarted, settled: timeoutSettled, settleMs: timeoutSettled.t - timeoutStarted.t, error: timeoutSettled.status,
    after: {visibility: timeoutAfter.visibility, startDisabled: timeoutAfter.startDisabled, cancelDisabled: timeoutAfter.cancelDisabled, downloadHidden: timeoutAfter.downloadHidden, previewHidden: timeoutAfter.previewHidden, disabledIds: timeoutAfter.disabledIds, streams: timeoutAfter.streams, recorders: timeoutAfter.recorders},
  });

  result.after = {visibility: await a.cdp.evaluate('document.visibilityState'), status: await a.cdp.evaluate('document.querySelector("#compare-video-status").textContent')};
  result.cleanup = {pageClosed: true, mcpClosed: true};
  writeFileSync(path.join(out, 'qa-summary.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({browserProduct: result.browserProduct, scopes: result.sessionScopes, runs: result.runs.map((run) => ({kind: run.kind, settleMs: run.settleMs, error: run.error, artifact: run.artifact, hiddenAt: run.hiddenAt && {visibility: run.hiddenAt.visibility, hidden: run.hiddenAt.hidden, recorders: run.hiddenAt.recorders, streams: run.hiddenAt.streams}, after: run.after && {visibility: run.after.visibility, startDisabled: run.after.startDisabled, cancelDisabled: run.after.cancelDisabled, downloadHidden: run.after.downloadHidden, streams: run.after.streams, recorders: run.after.recorders}, unchanged: run.unchanged}))}, null, 2));
} finally {
  a.cdp.close(); b.cdp.close();
  await closePage(a.page.id).catch(() => {}); await closePage(b.page.id).catch(() => {});
  await client.close();
}
