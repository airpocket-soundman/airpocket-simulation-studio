// Limited CLI that runs the ACP v1 initialize probe against one explicitly
// configured agent. It reads an absolute JSON config file and does exactly one
// thing: spawn the configured executable, initialize, then stop. It never
// searches PATH, installs, logs in, restarts, authenticates, or creates a
// session, and it never prints the process environment, argv, or raw stderr.
//
// Usage: node scripts/probe-acp-agent.mjs --config=<absolute path to config.json>
// Config JSON: {
//   "executable": "<absolute path>",
//   "argv": ["<arg>", ...],
//   "cwd": "<absolute path>",
//   "initializeTimeoutMs": 10000,   // optional
//   "stopGraceMs": 2000,            // optional
//   "forceKillWaitMs": 2000         // optional
// }

import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AcpClientProcess, ACP_PROTOCOL_VERSION, ACP_SCHEMA_REFERENCE } from './acp-client-process.mjs';

const usage = 'Usage: node scripts/probe-acp-agent.mjs --config=<absolute path to config.json>';

const ALLOWED_CONFIG_KEYS = new Set([
  'executable', 'argv', 'cwd', 'initializeTimeoutMs', 'stopGraceMs', 'forceKillWaitMs'
]);

export function parseProbeArgs(argv) {
  let configPath = null;
  for (const arg of argv) {
    const match = /^--config=(.+)$/.exec(arg);
    if (!match || configPath !== null) throw new Error(usage);
    configPath = match[1];
  }
  if (configPath === null || configPath.includes('\0') || !isAbsolute(configPath)) throw new Error(usage);
  return { configPath: resolve(configPath) };
}

function boundedString(value, limit = 128) {
  return typeof value === 'string' ? value.slice(0, limit) : null;
}

// Keep the implementation info readable but bounded; drop anything unexpected.
function sanitizeImplementation(info) {
  if (info === null || typeof info !== 'object' || Array.isArray(info)) return null;
  const clean = {};
  for (const key of ['name', 'title', 'version']) {
    const value = boundedString(info[key]);
    if (value !== null) clean[key] = value;
  }
  return Object.keys(clean).length ? clean : null;
}

function sanitizeAuthMethodIds(authMethods) {
  if (!Array.isArray(authMethods)) return [];
  return authMethods
    .map(method => (method && typeof method.id === 'string' ? boundedString(method.id) : null))
    .filter(id => id !== null && id.length > 0);
}

async function main() {
  const { configPath } = parseProbeArgs(process.argv.slice(2));
  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Config must be a JSON object');
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) throw new Error(`Unsupported config field: ${key}`);
  }

  const client = new AcpClientProcess(raw);
  let ready = null;
  let stop = null;
  let error = null;
  try {
    ready = await client.start();
  } catch (failure) {
    error = failure.message;
  } finally {
    try {
      stop = await client.stop(error ? 'probe-failed' : 'probe-complete');
    } catch (stopFailure) {
      error = error ?? stopFailure.message;
    }
  }

  const report = {
    reference: ACP_SCHEMA_REFERENCE,
    protocolVersionImplemented: ACP_PROTOCOL_VERSION,
    ready: ready !== null,
    protocolVersion: ready ? ready.protocolVersion : null,
    agentInfo: ready ? sanitizeImplementation(ready.agentInfo) : null,
    authMethodIds: ready ? sanitizeAuthMethodIds(ready.authMethods) : [],
    state: client.state,
    failure: client.failure,
    stop,
    error
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (error || ready === null || !stop || !stop.exited) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`ACP probe failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
