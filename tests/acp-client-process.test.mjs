// Targeted tests for the ACP v1 initialize/ownership probe.
//
// All agent behavior comes from a real Node subprocess fixture
// (tests/fixtures/acp-agent-stub.mjs); no fake timer is used to declare cleanup
// success. Only the pathological "child never exits" branch injects a no-op kill
// and that test is limited to proving the explicit failure reporting.

import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  AcpClientProcess,
  ACP_PROTOCOL_VERSION,
  ACP_SCHEMA_REFERENCE,
  advertisedClientCapabilities,
  buildInitializeRequest,
  validateInitializeResult
} from '../scripts/acp-client-process.mjs';

const stubPath = fileURLToPath(new URL('./fixtures/acp-agent-stub.mjs', import.meta.url));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const configFor = (mode, overrides = {}) => ({
  executable: process.execPath,
  argv: [stubPath, mode],
  cwd: repoRoot,
  installSignalHandlers: false,
  ...overrides
});

test('pins the ACP v1 schema release, tag, and schema hash', () => {
  assert.equal(ACP_PROTOCOL_VERSION, 1);
  assert.equal(ACP_SCHEMA_REFERENCE.tag, 'schema-v1.26.0');
  assert.equal(ACP_SCHEMA_REFERENCE.schemaUrl.includes('releases/download/schema-v1.26.0/schema.json'), true);
  assert.match(ACP_SCHEMA_REFERENCE.schemaSha256, /^[0-9a-f]{64}$/);
  assert.match(ACP_SCHEMA_REFERENCE.tagObjectSha, /^[0-9a-f]{40}$/);
  assert.match(ACP_SCHEMA_REFERENCE.commitSha, /^[0-9a-f]{40}$/);
});

test('advertises no unimplemented client capabilities', () => {
  const caps = advertisedClientCapabilities();
  const request = buildInitializeRequest(7);
  assert.equal(request.jsonrpc, '2.0');
  assert.equal(request.id, 7);
  assert.equal(request.method, 'initialize');
  assert.equal(request.params.protocolVersion, 1);
  assert.deepEqual(request.params.clientCapabilities, caps);
  assert.equal(JSON.stringify(caps).includes('true'), false);
});

test('validateInitializeResult enforces the v1 required shape', () => {
  assert.throws(() => validateInitializeResult(null), /must be a JSON object/);
  assert.throws(() => validateInitializeResult({}), /integer protocolVersion/);
  assert.throws(() => validateInitializeResult({ protocolVersion: 2 }), /unsupported protocolVersion 2/);
  assert.throws(() => validateInitializeResult({ protocolVersion: 1, authMethods: 'x' }), /authMethods must be an array/);
  const ok = validateInitializeResult({ protocolVersion: 1, authMethods: [] });
  assert.equal(ok.protocolVersion, 1);
  assert.deepEqual(ok.authMethods, []);
  assert.equal(ok.agentInfo, null);
});

test('initialize reaches ready with a v1 state history and one owned child', async () => {
  const client = new AcpClientProcess(configFor('normal'));
  const states = [];
  const outbound = [];
  client.on('state', event => states.push(event.state));
  client.on('outbound', message => outbound.push(message.method));
  const ready = await client.start();
  assert.equal(client.state, 'ready');
  assert.equal(ready.protocolVersion, 1);
  assert.equal(ready.agentInfo.name, 'acp-stub');
  assert.ok(Number.isInteger(client.pid) && client.pid > 0);
  assert.deepEqual(states, ['starting', 'initializing', 'ready']);
  // Only initialize is sent: no session/new and no authenticate.
  assert.deepEqual(outbound, ['initialize']);
  const stop = await client.stop();
  assert.equal(client.state, 'stopped');
  assert.equal(stop.exited, true);
  assert.equal(stop.forced, false);
  assert.equal(client.activeChildPid, null);
  assert.equal(client.diagnostics().activeTimers, 0);
});

test('decodes a response whose UTF-8 bytes are split across stdout chunks', async () => {
  const client = new AcpClientProcess(configFor('split'));
  const ready = await client.start();
  assert.equal(ready.protocolVersion, 1);
  assert.match(ready.agentInfo.title, /日本語/);
  assert.match(ready.agentInfo.title, /🙂/);
  await client.stop();
  assert.equal(client.state, 'stopped');
});

test('handles two records delivered in a single chunk', async () => {
  const client = new AcpClientProcess(configFor('double'));
  const ready = await client.start();
  assert.equal(ready.protocolVersion, 1);
  const stop = await client.stop();
  assert.equal(stop.exited, true);
  assert.equal(client.state, 'stopped');
});

test('fails fast on a stdout record that is not valid JSON', async () => {
  const client = new AcpClientProcess(configFor('invalid-json', { initializeTimeoutMs: 3000 }));
  await assert.rejects(client.start(), /not valid JSON/);
  assert.equal(client.state, 'failed');
  assert.equal(client.activeChildPid, null);
  assert.equal(client.diagnostics().activeTimers, 0);
});

test('fails fast on stray stdout logging', async () => {
  const client = new AcpClientProcess(configFor('noise', { initializeTimeoutMs: 3000 }));
  await assert.rejects(client.start(), /not valid JSON/);
  assert.equal(client.state, 'failed');
  assert.equal(client.activeChildPid, null);
});

test('rejects a response whose id does not match the outstanding request', async () => {
  const client = new AcpClientProcess(configFor('wrong-id', { initializeTimeoutMs: 3000 }));
  await assert.rejects(client.start(), /does not match any outstanding request/);
  assert.equal(client.state, 'failed');
  assert.equal(client.activeChildPid, null);
});

test('does not become ready on an unsupported protocol version', async () => {
  const client = new AcpClientProcess(configFor('version2', { initializeTimeoutMs: 3000 }));
  await assert.rejects(client.start(), /unsupported protocolVersion 2/);
  assert.notEqual(client.state, 'ready');
  assert.equal(client.state, 'failed');
  const stop = await client.stop();
  assert.equal(stop.exited, true);
  assert.equal(client.activeChildPid, null);
});

test('a child exiting during initialize fails without becoming ready', async () => {
  const client = new AcpClientProcess(configFor('exit-early', { initializeTimeoutMs: 3000 }));
  await assert.rejects(client.start());
  assert.equal(client.state, 'failed');
  assert.equal(client.activeChildPid, null);
});

test('rejects a second start while a child is already owned and keeps the same pid', async () => {
  const client = new AcpClientProcess(configFor('normal'));
  await client.start();
  const pid = client.pid;
  await assert.rejects(client.start(), /already owns a child/);
  assert.equal(client.pid, pid);
  await client.stop();
});

test('stop is idempotent and removes the child, timers, and signal listeners', async () => {
  const baseline = process.listenerCount('SIGINT');
  const client = new AcpClientProcess(configFor('normal', { installSignalHandlers: true }));
  await client.start();
  assert.ok(process.listenerCount('SIGINT') > baseline);
  const first = await client.stop();
  const second = await client.stop();
  assert.equal(first.exited, true);
  assert.equal(second.exited, true);
  assert.equal(client.state, 'stopped');
  assert.equal(client.activeChildPid, null);
  assert.equal(client.diagnostics().activeTimers, 0);
  assert.equal(client.diagnostics().signalHandlersInstalled, false);
  assert.equal(process.listenerCount('SIGINT'), baseline);
});

test('initialize timeout fails and stops the owned child', async () => {
  const client = new AcpClientProcess(configFor('silent', { initializeTimeoutMs: 300, stopGraceMs: 500, forceKillWaitMs: 500 }));
  await assert.rejects(client.start(), /timed out after 300ms/);
  assert.equal(client.state, 'failed');
  assert.equal(client.activeChildPid, null);
  assert.equal(client.diagnostics().activeTimers, 0);
});

test('an owned child that ignores stdin EOF is force-stopped', async () => {
  const client = new AcpClientProcess(configFor('ready-then-hang', { stopGraceMs: 200, forceKillWaitMs: 2000 }));
  await client.start();
  const stop = await client.stop();
  assert.equal(stop.exited, true);
  assert.equal(stop.forced, true);
  assert.equal(client.state, 'stopped');
  assert.equal(client.activeChildPid, null);
  assert.equal(client.diagnostics().activeTimers, 0);
});

test('reports explicit failure when the owned child never exits', async () => {
  // Injected no-op kill: this test proves the failure reporting, not that a real
  // Node process can survive termination.
  const client = new AcpClientProcess(configFor('ready-then-hang', { stopGraceMs: 100, forceKillWaitMs: 100, killProcess: () => {} }));
  await client.start();
  const pid = client.pid;
  const stop = await client.stop();
  assert.equal(stop.exited, false);
  assert.equal(client.state, 'failed');
  assert.match(stop.failure, /did not exit/);
  assert.equal(client.diagnostics().activeTimers, 0);
  try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
});

test('rejects an agent-to-client request with method-not-found and never authenticates', async () => {
  const client = new AcpClientProcess(configFor('agent-request', { initializeTimeoutMs: 3000 }));
  const outbound = [];
  client.on('outbound', message => outbound.push(message.method));
  const rejected = new Promise(resolve => client.once('client-request-rejected', resolve));
  await client.start();
  const event = await rejected;
  assert.equal(event.method, 'fs/read_text_file');
  assert.equal(event.code, -32601);
  assert.deepEqual(outbound, ['initialize', null]);
  assert.equal(outbound.includes('authenticate'), false);
  assert.equal(outbound.includes('session/new'), false);
  await client.stop();
});

test('aborts a stdout record that exceeds the per-record limit', async () => {
  const client = new AcpClientProcess(configFor('oversize', { maxStdoutRecordBytes: 4096, initializeTimeoutMs: 3000 }));
  await assert.rejects(client.start(), /exceeded 4096 bytes/);
  assert.equal(client.state, 'failed');
  assert.equal(client.activeChildPid, null);
});

test('bounds stderr retention without failing the connection and keeps it out of state', async () => {
  const client = new AcpClientProcess(configFor('stderr-loud', { maxStderrRetentionBytes: 4096 }));
  const ready = await client.start();
  assert.equal(ready.protocolVersion, 1);
  const diagnostics = client.diagnostics();
  assert.equal(diagnostics.stderrRetainedBytes <= 4096, true);
  assert.equal(diagnostics.stderrTruncated, true);
  assert.equal('stderr' in ready, false);
  await client.stop();
});

test('does not expose the process environment in its state description', async () => {
  const sentinel = 'ACP_PROBE_SECRET_SENTINEL_9f3c';
  process.env.ACP_PROBE_SENTINEL = sentinel;
  try {
    const client = new AcpClientProcess(configFor('normal'));
    await client.start();
    assert.equal(JSON.stringify(client.describe()).includes(sentinel), false);
    assert.equal(JSON.stringify(client.diagnostics()).includes(sentinel), false);
    await client.stop();
  } finally {
    delete process.env.ACP_PROBE_SENTINEL;
  }
});
