[日本語](../agent-acp-probe.md)

# ACP initialize probe and owned-child lifecycle (AGENTACP1)

Scope: a Node host that owns exactly **one** user-specified ACP agent child, runs
the `initialize` handshake over the ACP stdio transport, and stops that child
safely. Everything else in ACP is deliberately out of scope for this unit:
`session/new`, `session/prompt`, authentication execution, MCP delegation, and
model selection are follow-ups. Nothing here is spawned from the browser.

The real Codex ACP invocation is **not confirmed**. There is no `codex --acp`
guess, no PATH search, no install, no login, and no implicit restart anywhere in
this code.

## Fixed protocol reference (retrieved 2026-10-19)

Only ACP **v1** (integer `protocolVersion` `1`) is negotiated. The v2 draft is
never mixed in.

| Item | Value |
| --- | --- |
| stdio transport | https://agentclientprotocol.com/protocol/v1/transports |
| initialization | https://agentclientprotocol.com/protocol/v1/initialization |
| schema page | https://agentclientprotocol.com/protocol/v1/schema |
| schema release | `schema-v1.26.0` — https://github.com/agentclientprotocol/agent-client-protocol/releases/tag/schema-v1.26.0 |
| tag object SHA | `3fdcc2cb717e1dfa50f2efcaeae88cb69a6504cd` |
| tagged commit SHA | `e2d83349bc9e28a4059ea3acefa1c91c966f74e2` |
| schema.json URL | https://github.com/agentclientprotocol/agent-client-protocol/releases/download/schema-v1.26.0/schema.json |
| schema.json SHA-256 | `4bcd1d2051ff7ed379bd9b234fb9b09c5ab9245478698e9fab805bd9b52a33a6` |
| schema.json size | 255170 bytes |

These constants live in `scripts/acp-client-process.mjs` as `ACP_SCHEMA_REFERENCE`
so a future change to the pinned release is explicit.

## What initialize sends and requires

The `initialize` request is built by `buildInitializeRequest(id)`:

- `jsonrpc: "2.0"`, integer `id`.
- `params.protocolVersion = 1`.
- `params.clientCapabilities`: every field is `false`
  (`fs.readTextFile`, `fs.writeTextFile`, `terminal`, `auth.terminal`). The probe
  advertises **nothing it cannot serve**; ACP treats omitted capabilities as
  unsupported, so the explicit `false` values match the schema default without
  claiming filesystem, terminal, or terminal-auth support.
- `params.clientInfo`: probe name/title/version. No secret is placed here.

The response is validated by `validateInitializeResult`:

- `result` must be a JSON object.
- `result.protocolVersion` must be an integer and must equal `1`. Any other
  version (for example the v2 draft value `2`) makes the client stop and fail
  instead of reporting `ready`.
- `agentCapabilities` (if present) must be an object; `agentInfo` (if present)
  must be an object or `null`; `authMethods` (if present) must be an array.
- `authMethods` are **recorded, never used**. The probe never calls
  `authenticate`, so it never selects an advertised or unadvertised method.

Only the initialization shape is implemented. No session, content, or tool-call
schema is created here; unreadable fields are not guessed.

## stdio framing

ACP stdio is newline-delimited UTF-8 JSON-RPC. Newlines never occur inside a
UTF-8 sequence, so the parser buffers raw bytes and splits on the `0x0a` byte.
This keeps multibyte characters intact when one character spans two chunks, and
handles several records arriving in a single chunk. A trailing `\r` is stripped.

Any stdout record that is not a valid JSON-RPC object is a protocol violation:
an empty record, non-JSON text (stray logging), or a shape that is neither a
request (`method` + `id`), a notification (`method`), nor a response
(`id` + `result`/`error`). A response whose `id` does not match an outstanding
request is also a violation.

Agent-to-client requests are rejected with JSON-RPC method-not-found (`-32601`),
because no client-side ACP method is implemented in this probe. Notifications
from the agent are ignored (no response).

## Lifecycle and limits

State machine: `idle → starting → initializing → ready → stopping → stopped`.
Any protocol violation, unexpected exit, or unconfirmed termination becomes
`failed`. `ready` means only that the initialize handshake succeeded; it does
**not** mean authenticated or able to converse, and no session exists.

| Concern | Value |
| --- | --- |
| Concurrent owned children | 1 (a second `start()` is rejected and does not spawn) |
| initialize timeout | 10000 ms |
| stop grace (stdin EOF) | 2000 ms |
| force-kill wait | 2000 ms |
| stdout per-record cap | 1 MiB (exceeding it disconnects and fails) |
| stderr retention cap | 64 KiB (oldest bytes dropped; raw stderr is never surfaced) |

`stop()` closes the child's stdin, waits the grace period, then force-kills and
waits again. If the owned child still has not exited, the result reports
`exited: false` and the state becomes `failed`. `stop()` is idempotent: a second
call returns the first shutdown's result. Parent `SIGINT`/`SIGTERM` trigger the
same shutdown (handlers are installed only when `installSignalHandlers` is not
`false`, and are removed once the child closes).

Ownership is limited to the child this process spawned. Terminating that child
with `kill()` does **not** prove that any grandchild process tree on Windows is
also gone; this unit makes **no such claim**. After a confirmed close, no timers
or signal listeners remain (`diagnostics()` reports `activeTimers` and
`signalHandlersInstalled`).

## Secrets

The child inherits the parent environment so it can run, but the environment is
never stored on the client, logged, emitted, or returned. `describe()` and
`diagnostics()` expose only state, pid, negotiated protocol info, bounded stderr
byte counts, and failure text. Raw stderr is never placed into evidence.

## CLI

```
node scripts/probe-acp-agent.mjs --config=<absolute path to config.json>
```

Config JSON (only these fields are accepted):

```json
{
  "executable": "<absolute path>",
  "argv": ["<arg>", "..."],
  "cwd": "<absolute path>",
  "initializeTimeoutMs": 10000,
  "stopGraceMs": 2000,
  "forceKillWaitMs": 2000
}
```

The CLI initializes once and stops, then prints a sanitized JSON report
(reference, ready flag, negotiated version, bounded `agentInfo`, auth method
**ids** only, state, stop result). It never prints argv, the environment, or raw
stderr. Exit code is `0` only when initialize succeeded and the child exited.

## Status: real agent not connected

Only the synthetic fixture `tests/fixtures/acp-agent-stub.mjs` is used. No
production ACP agent (including Codex) has been launched, because the real
invocation is unverified. Connecting a real agent requires a primary-source
reference for that agent's ACP entry point; guessing a command is prohibited.

## Tests

```
node --test tests/acp-client-process.test.mjs
git diff --check
```

The fixture is a real Node subprocess. The single test that exercises the
"owned child never exits" branch injects a no-op kill on purpose, and its result
proves only the explicit failure reporting — not that a real process can survive
termination.
