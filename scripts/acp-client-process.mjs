// ACP v1 stdio transport + initialize probe.
//
// Scope of this module: own exactly one user-specified ACP agent child, run the
// `initialize` handshake, and stop it safely. It deliberately implements nothing
// else: no session/new, no session/prompt, no authentication execution, no MCP
// delegation, and no model selection. The real Codex ACP invocation is not
// confirmed anywhere; this module never guesses it, never searches PATH for an
// executable, never installs, logs in, or restarts implicitly.
//
// Pinned protocol reference (retrieved 2026-10-19). Only protocolVersion 1 is
// negotiated; the ACP v2 draft is never mixed in:
//   transports  https://agentclientprotocol.com/protocol/v1/transports
//   initialize  https://agentclientprotocol.com/protocol/v1/initialization
//   schema      https://agentclientprotocol.com/protocol/v1/schema
//   release     https://github.com/agentclientprotocol/agent-client-protocol/releases/tag/schema-v1.26.0

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { isAbsolute } from 'node:path';

// Only the v1 integer protocol version is implemented.
export const ACP_PROTOCOL_VERSION = 1;

export const ACP_SCHEMA_REFERENCE = Object.freeze({
  releaseUrl: 'https://github.com/agentclientprotocol/agent-client-protocol/releases/tag/schema-v1.26.0',
  tag: 'schema-v1.26.0',
  tagObjectSha: '3fdcc2cb717e1dfa50f2efcaeae88cb69a6504cd',
  commitSha: 'e2d83349bc9e28a4059ea3acefa1c91c966f74e2',
  schemaUrl: 'https://github.com/agentclientprotocol/agent-client-protocol/releases/download/schema-v1.26.0/schema.json',
  schemaSha256: '4bcd1d2051ff7ed379bd9b234fb9b09c5ab9245478698e9fab805bd9b52a33a6',
  schemaSizeBytes: 255170,
  retrievedAt: '2026-10-19'
});

export const ACP_PROBE_DEFAULTS = Object.freeze({
  initializeTimeoutMs: 10000,
  stopGraceMs: 2000,
  forceKillWaitMs: 2000,
  maxStdoutRecordBytes: 1024 * 1024,
  maxStderrRetentionBytes: 64 * 1024
});

// Implementation information for the initialize request. ACP only requires a
// name; title/version are optional display hints. This value carries no secret.
const CLIENT_INFO = Object.freeze({
  name: 'airpocket-simulation-studio-acp-probe',
  title: 'AirPocket Simulation Studio ACP probe',
  version: '0.1.0'
});

// Client capabilities advertised in the initialize request. Nothing beyond the
// initialize handshake is implemented, so every capability is explicitly false
// (ACP treats omitted capabilities as unsupported; false mirrors the schema
// default without advertising fs, terminal, or terminal-authentication support).
export function advertisedClientCapabilities() {
  return {
    fs: { readTextFile: false, writeTextFile: false },
    terminal: false,
    auth: { terminal: false }
  };
}

export function buildInitializeRequest(id) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: advertisedClientCapabilities(),
      clientInfo: { ...CLIENT_INFO }
    }
  };
}

// Validate the initialize response against the required v1 shape. Unknown fields
// are preserved via the returned object only where the v1 schema names them; no
// session or authentication schema is invented here.
export function validateInitializeResult(result) {
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('initialize response "result" must be a JSON object');
  }
  const { protocolVersion } = result;
  if (!Number.isInteger(protocolVersion)) {
    throw new Error('initialize response is missing an integer protocolVersion');
  }
  if (protocolVersion !== ACP_PROTOCOL_VERSION) {
    throw new Error(`unsupported protocolVersion ${protocolVersion}: this probe implements ACP v1 (protocolVersion ${ACP_PROTOCOL_VERSION}) only`);
  }
  if ('agentCapabilities' in result && result.agentCapabilities !== null
    && (typeof result.agentCapabilities !== 'object' || Array.isArray(result.agentCapabilities))) {
    throw new Error('initialize response agentCapabilities must be an object when present');
  }
  if ('agentInfo' in result && result.agentInfo !== null
    && (typeof result.agentInfo !== 'object' || Array.isArray(result.agentInfo))) {
    throw new Error('initialize response agentInfo must be an object when present');
  }
  if ('authMethods' in result && !Array.isArray(result.authMethods)) {
    throw new Error('initialize response authMethods must be an array when present');
  }
  return Object.freeze({
    protocolVersion,
    agentCapabilities: result.agentCapabilities ?? null,
    agentInfo: result.agentInfo ?? null,
    authMethods: result.authMethods ? [...result.authMethods] : []
  });
}

function normalizeConfig(config) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('AcpClientProcess requires a configuration object');
  }
  const { executable, argv, cwd } = config;
  if (typeof executable !== 'string' || !isAbsolute(executable) || executable.includes('\0')) {
    throw new Error('ACP agent executable must be an absolute path (no implicit PATH search)');
  }
  if (!Array.isArray(argv) || argv.some(part => typeof part !== 'string' || part.includes('\0'))) {
    throw new Error('ACP agent argv must be an array of strings');
  }
  if (typeof cwd !== 'string' || !isAbsolute(cwd) || cwd.includes('\0')) {
    throw new Error('ACP agent cwd must be an absolute path');
  }
  const positiveInteger = (name, fallback) => {
    const value = config[name] ?? fallback;
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be an integer >= 1`);
    return value;
  };
  const killProcess = config.killProcess ?? ((child, signal) => child.kill(signal));
  if (typeof killProcess !== 'function') throw new Error('killProcess must be a function when provided');
  return Object.freeze({
    executable,
    argv: [...argv],
    cwd,
    initializeTimeoutMs: positiveInteger('initializeTimeoutMs', ACP_PROBE_DEFAULTS.initializeTimeoutMs),
    stopGraceMs: positiveInteger('stopGraceMs', ACP_PROBE_DEFAULTS.stopGraceMs),
    forceKillWaitMs: positiveInteger('forceKillWaitMs', ACP_PROBE_DEFAULTS.forceKillWaitMs),
    maxStdoutRecordBytes: positiveInteger('maxStdoutRecordBytes', ACP_PROBE_DEFAULTS.maxStdoutRecordBytes),
    maxStderrRetentionBytes: positiveInteger('maxStderrRetentionBytes', ACP_PROBE_DEFAULTS.maxStderrRetentionBytes),
    installSignalHandlers: config.installSignalHandlers !== false,
    killProcess
  });
}

// Owns at most one agent child. `env` is inherited from the parent process for
// the child to work, but it is never stored, logged, emitted, or returned.
export class AcpClientProcess extends EventEmitter {
  #config;
  #state = 'idle';
  #stateHistory = [];
  #child = null;
  #closePromise = null;
  #resolveClose = null;
  #stopPromise = null;
  #stopReason = null;
  #failure = null;
  #readyInfo = null;
  #nextId = 1;
  #pending = new Map();
  #timers = new Set();
  #stdout = Buffer.alloc(0);
  #stderr = Buffer.alloc(0);
  #stderrTruncated = false;
  #signalHandlers = null;

  constructor(config = {}) {
    super();
    this.#config = normalizeConfig(config);
  }

  get state() { return this.#state; }
  get pid() { return this.#child ? this.#child.pid ?? null : null; }
  get activeChildPid() { return this.#child ? this.#child.pid ?? null : null; }
  get failure() { return this.#failure ? this.#failure.message : null; }
  get stateHistory() { return [...this.#stateHistory]; }

  // Diagnostics for tests and callers that need to prove cleanup. Contains no
  // environment values and never returns raw stderr bytes.
  diagnostics() {
    return {
      state: this.#state,
      activeChild: this.#child !== null,
      activeTimers: this.#timers.size,
      pendingRequests: this.#pending.size,
      stderrRetainedBytes: this.#stderr.length,
      stderrTruncated: this.#stderrTruncated,
      signalHandlersInstalled: this.#signalHandlers !== null
    };
  }

  // `ready` means the initialize handshake succeeded. It does not mean the agent
  // is authenticated or ready to converse, and no session has been created.
  describe() {
    return {
      state: this.#state,
      pid: this.pid,
      protocolVersion: this.#readyInfo?.protocolVersion ?? null,
      agentInfo: this.#readyInfo?.agentInfo ?? null,
      agentCapabilities: this.#readyInfo?.agentCapabilities ?? null,
      authMethods: this.#readyInfo?.authMethods ?? [],
      failure: this.#failure ? this.#failure.message : null,
      stderrRetainedBytes: this.#stderr.length
    };
  }

  async start() {
    if (this.#state !== 'idle') {
      throw new Error(`AcpClientProcess already owns a child (state ${this.#state}); simultaneous children are limited to one`);
    }
    this.#setState('starting');
    const child = spawn(this.#config.executable, this.#config.argv, {
      cwd: this.#config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true
    });
    this.#child = child;
    this.#closePromise = new Promise(resolve => { this.#resolveClose = resolve; });
    child.on('error', error => { this.#fail(error instanceof Error ? error : new Error(String(error))); });
    // Swallow stream-level errors (e.g. EPIPE after an early exit) so a broken
    // pipe fails the connection through the close/error handlers instead of
    // becoming an uncaught exception.
    child.stdin.on('error', () => {});
    child.stdout.on('error', () => {});
    child.stderr.on('error', () => {});
    child.stdout.on('data', chunk => this.#consumeStdout(chunk));
    child.stderr.on('data', chunk => this.#consumeStderr(chunk));
    child.on('close', (code, signal) => this.#onClose(code, signal));
    if (this.#config.installSignalHandlers) this.#installSignalHandlers();
    this.#setState('initializing');
    try {
      this.#readyInfo = validateInitializeResult(await this.#initialize());
      this.#setState('ready');
      return this.describe();
    } catch (error) {
      this.#fail(error);
      await this.stop('start-failed').catch(() => {});
      throw error;
    }
  }

  // Safe to call twice: the second call returns the first shutdown's promise.
  // On success the owned child is closed and awaited; if the child does not exit
  // after the grace period plus the force-kill wait, the state becomes `failed`
  // and the result reports exited:false explicitly.
  async stop(reason = 'requested') {
    if (this.#stopPromise) return this.#stopPromise;
    this.#stopReason = reason;
    this.#stopPromise = this.#shutdown(reason);
    return this.#stopPromise;
  }

  async #initialize() {
    const id = this.#nextId++;
    const response = await this.#request(buildInitializeRequest(id), this.#config.initializeTimeoutMs, 'initialize');
    return response.result;
  }

  #request(message, timeoutMs, label) {
    const id = message.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#timers.delete(timer);
        this.#pending.delete(id);
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.#timers.add(timer);
      this.#pending.set(id, { resolve, reject, timer });
      try {
        this.#write(message);
      } catch (error) {
        clearTimeout(timer);
        this.#timers.delete(timer);
        this.#pending.delete(id);
        reject(error);
      }
    });
  }

  #write(message) {
    const child = this.#child;
    if (!child || !child.stdin || child.stdin.destroyed) {
      throw new Error('Cannot write to the ACP agent: stdio pipe is not open');
    }
    child.stdin.write(Buffer.from(`${JSON.stringify(message)}\n`, 'utf8'));
    // Only the method and id are emitted; request params are never republished.
    this.emit('outbound', { method: typeof message.method === 'string' ? message.method : null, id: message.id ?? null });
  }

  #consumeStdout(chunk) {
    this.#stdout = Buffer.concat([this.#stdout, chunk]);
    for (;;) {
      const newline = this.#stdout.indexOf(0x0a);
      if (newline < 0) break;
      let line = this.#stdout.subarray(0, newline);
      this.#stdout = this.#stdout.subarray(newline + 1);
      if (line.length && line[line.length - 1] === 0x0d) line = line.subarray(0, line.length - 1);
      if (line.length > this.#config.maxStdoutRecordBytes) {
        this.#violation(`ACP stdout record exceeded ${this.#config.maxStdoutRecordBytes} bytes (per-record limit)`);
        return;
      }
      this.#dispatchLine(line);
      if (this.#state === 'failed') return;
    }
    if (this.#stdout.length > this.#config.maxStdoutRecordBytes) {
      this.#violation(`ACP stdout record exceeded ${this.#config.maxStdoutRecordBytes} bytes without a terminating newline`);
    }
  }

  // ACP stdio is newline-delimited UTF-8 JSON-RPC. Newlines cannot appear inside
  // a UTF-8 sequence, so splitting on the 0x0a byte keeps multibyte characters
  // intact even when they span two chunks.
  #dispatchLine(line) {
    if (line.length === 0) {
      this.#violation('ACP stdout contained an empty record');
      return;
    }
    let message;
    try {
      message = JSON.parse(line.toString('utf8'));
    } catch {
      this.#violation('ACP stdout contained a record that is not valid JSON');
      return;
    }
    if (message === null || typeof message !== 'object' || Array.isArray(message)) {
      this.#violation('ACP stdout record is not a JSON-RPC object');
      return;
    }
    const hasMethod = typeof message.method === 'string';
    const hasId = Object.hasOwn(message, 'id') && message.id !== null && message.id !== undefined;
    const hasResult = Object.hasOwn(message, 'result');
    const hasError = Object.hasOwn(message, 'error');
    if (hasMethod && hasId) {
      this.#rejectClientRequest(message);
      return;
    }
    if (hasMethod) {
      this.emit('notification', { method: message.method });
      return;
    }
    if (hasId && (hasResult || hasError)) {
      this.#resolveResponse(message);
      return;
    }
    this.#violation('ACP stdout record is not a recognized JSON-RPC request, notification, or response');
  }

  // No client-side ACP method is implemented in this probe, so every agent-to-client
  // request is unknown and rejected with JSON-RPC method-not-found (-32601).
  #rejectClientRequest(message) {
    const response = { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } };
    try {
      this.#write(response);
    } catch {
      // The pipe is already gone; the close handler will fail the connection.
    }
    this.emit('client-request-rejected', { method: message.method, id: message.id, code: -32601 });
  }

  #resolveResponse(message) {
    const pending = this.#pending.get(message.id);
    if (!pending) {
      this.#violation(`ACP stdout response id ${String(message.id)} does not match any outstanding request`);
      return;
    }
    this.#pending.delete(message.id);
    clearTimeout(pending.timer);
    this.#timers.delete(pending.timer);
    if (Object.hasOwn(message, 'error')) {
      const code = message.error?.code ?? null;
      const text = typeof message.error?.message === 'string' ? message.error.message.slice(0, 200) : null;
      pending.reject(new Error(`ACP request failed${code === null ? '' : ` (code ${code})`}${text ? `: ${text}` : ''}`));
    } else {
      pending.resolve(message);
    }
  }

  // stderr is retained up to a fixed cap so logs stay bounded; exceeding the cap
  // truncates the oldest bytes rather than failing the connection. Raw stderr is
  // never surfaced as evidence or in describe()/diagnostics().
  #consumeStderr(chunk) {
    this.#stderr = Buffer.concat([this.#stderr, chunk]);
    if (this.#stderr.length > this.#config.maxStderrRetentionBytes) {
      this.#stderr = this.#stderr.subarray(this.#stderr.length - this.#config.maxStderrRetentionBytes);
      this.#stderrTruncated = true;
    }
  }

  #violation(reason) {
    this.#fail(new Error(reason));
    this.stop('protocol-error').catch(() => {});
  }

  #fail(error) {
    if (!this.#failure) this.#failure = error instanceof Error ? error : new Error(String(error));
    if (this.#state !== 'failed') this.#setState('failed');
    this.#rejectPending(this.#failure);
  }

  #rejectPending(error) {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      this.#timers.delete(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #onClose(code, signal) {
    this.#removeSignalHandlers();
    this.#rejectPending(this.#failure ?? new Error(`ACP agent process closed (code ${code}, signal ${signal}) before the connection completed`));
    this.#child = null;
    if (this.#state === 'stopping') {
      this.#setState('stopped');
    } else if (this.#state !== 'failed' && this.#state !== 'stopped') {
      this.#fail(new Error(`ACP agent process exited unexpectedly (code ${code}, signal ${signal})`));
    }
    const resolve = this.#resolveClose;
    this.#resolveClose = null;
    resolve?.({ code, signal });
  }

  async #shutdown(reason) {
    const child = this.#child;
    if (!child) {
      if (this.#state !== 'failed') this.#setState('stopped', reason);
      return { exited: true, forced: false, reason, failure: this.#failure ? this.#failure.message : null };
    }
    if (this.#state !== 'failed') this.#setState('stopping', reason);
    const closePromise = this.#closePromise;
    // Closing stdin is the ACP shutdown signal; give the agent a grace window.
    try { child.stdin.end(); } catch { /* pipe already gone */ }
    let closed = await this.#raceClose(this.#config.stopGraceMs, closePromise);
    let forced = false;
    if (!closed) {
      forced = true;
      try { this.#config.killProcess(child, 'SIGKILL'); } catch { /* process already gone */ }
      closed = await this.#raceClose(this.#config.forceKillWaitMs, closePromise);
    }
    if (!closed) {
      this.#fail(new Error(`owned child did not exit after ${this.#config.stopGraceMs}ms grace + ${this.#config.forceKillWaitMs}ms force-kill wait; termination is not confirmed`));
    }
    if (this.#state === 'stopping') this.#setState('stopped', reason);
    return { exited: closed, forced, reason, failure: this.#failure ? this.#failure.message : null };
  }

  #raceClose(ms, closePromise) {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.#timers.delete(timer);
        resolve(false);
      }, ms);
      this.#timers.add(timer);
      closePromise.then(() => {
        clearTimeout(timer);
        this.#timers.delete(timer);
        resolve(true);
      });
    });
  }

  #installSignalHandlers() {
    const onSignal = () => { this.stop('parent-signal').catch(() => {}); };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
    this.#signalHandlers = {
      remove: () => {
        process.off('SIGINT', onSignal);
        process.off('SIGTERM', onSignal);
      }
    };
  }

  #removeSignalHandlers() {
    this.#signalHandlers?.remove();
    this.#signalHandlers = null;
  }

  #setState(state, detail) {
    if (this.#state === state) return;
    this.#state = state;
    this.#stateHistory.push(state);
    this.emit('state', { state, detail: detail ?? null });
  }
}
