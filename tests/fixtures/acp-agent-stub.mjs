// Synthetic ACP agent used only by tests/acp-client-process.test.mjs.
//
// This is a real Node subprocess that speaks newline-delimited JSON-RPC over
// stdio. It is NOT a real agent adapter: it stands in for one so the client-side
// transport/lifecycle can be exercised on repeatable inputs, including the
// malformed cases the probe must survive. The stub writes nothing to stdout that
// it was not asked to, except in the explicit "noise"/"invalid-json" modes.
//
// Usage: node tests/fixtures/acp-agent-stub.mjs <mode>

const mode = process.argv[2] ?? 'normal';

const readyResponse = {
  jsonrpc: '2.0',
  result: {
    protocolVersion: 1,
    agentCapabilities: {
      loadSession: false,
      promptCapabilities: { image: false, audio: false, embeddedContext: false },
      mcpCapabilities: { http: false, sse: false }
    },
    agentInfo: { name: 'acp-stub', title: 'ACP stub 日本語🙂', version: '0.0.0' },
    authMethods: [{ id: 'stub-login', name: 'Stub login', description: 'Synthetic method; the probe must never select it' }]
  }
};

const writeLine = message => process.stdout.write(`${JSON.stringify(message)}\n`);

// Split the response bytes so the 4-byte emoji spans three stdout chunks. Each
// chunk is separated by a small delay so the reader sees distinct writes.
function writeSplit(message) {
  const buffer = Buffer.from(`${JSON.stringify(message)}\n`, 'utf8');
  const emoji = Buffer.from('🙂', 'utf8');
  let at = buffer.indexOf(emoji);
  if (at < 0) at = Math.max(1, Math.floor(buffer.length / 2));
  const cuts = [at + 1, at + 3];
  process.stdout.write(buffer.subarray(0, cuts[0]));
  setTimeout(() => {
    process.stdout.write(buffer.subarray(cuts[0], cuts[1]));
    setTimeout(() => process.stdout.write(buffer.subarray(cuts[1])), 5);
  }, 5);
}

function respondToInitialize(id) {
  switch (mode) {
    case 'normal':
    case 'agent-request':
      writeLine({ ...readyResponse, id });
      if (mode === 'agent-request') {
        setTimeout(() => writeLine({
          jsonrpc: '2.0',
          id: 777,
          method: 'fs/read_text_file',
          params: { sessionId: 'stub-session', path: 'C:/stub.txt' }
        }), 10);
      }
      break;
    case 'split':
      writeSplit({ ...readyResponse, id });
      break;
    case 'double':
      // Two records delivered in a single chunk.
      writeLine({ ...readyResponse, id });
      writeLine({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'stub-session', update: { sessionUpdate: 'agent_message_chunk' } } });
      break;
    case 'invalid-json':
      process.stdout.write('this is not valid JSON\n');
      break;
    case 'noise':
      process.stdout.write('acp-stub: synthetic startup log line\n');
      break;
    case 'wrong-id':
      writeLine({ ...readyResponse, id: 9999 });
      break;
    case 'version2':
      writeLine({ jsonrpc: '2.0', id, result: { protocolVersion: 2, agentCapabilities: {}, agentInfo: { name: 'acp-stub-v2', version: '0.0.0' }, authMethods: [] } });
      break;
    case 'oversize':
      writeLine({ ...readyResponse, id, result: { ...readyResponse.result, agentInfo: { ...readyResponse.result.agentInfo, padding: 'p'.repeat(8192) } } });
      break;
    case 'stderr-loud':
      process.stderr.write('s'.repeat(200000));
      writeLine({ ...readyResponse, id });
      break;
    case 'ready-then-hang':
      writeLine({ ...readyResponse, id });
      break;
    case 'silent':
    case 'hang':
      break;
    default:
      writeLine({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown stub mode ${mode}` } });
  }
}

function handle(message) {
  if (message === null || typeof message !== 'object') return;
  if (message.method === 'initialize') {
    respondToInitialize(message.id);
  }
}

if (mode === 'exit-early') {
  process.exit(0);
}

if (mode === 'hang' || mode === 'ready-then-hang') {
  // Ignore stdin EOF and stay alive until the client force-kills the process.
  setInterval(() => {}, 1000);
}

let input = '';
process.stdin.on('data', chunk => {
  input += chunk.toString('utf8');
  let index;
  while ((index = input.indexOf('\n')) >= 0) {
    const line = input.slice(0, index);
    input = input.slice(index + 1);
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    handle(message);
  }
});

process.stdin.on('end', () => {
  if (mode !== 'hang' && mode !== 'ready-then-hang') process.exit(0);
});
