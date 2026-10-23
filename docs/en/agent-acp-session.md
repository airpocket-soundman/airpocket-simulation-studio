# Bounded ACP text sessions (AGENTACP1)

[日本語](../agent-acp-session.md) / [Initialize probe](agent-acp-probe.md)

2026-10-23. `AcpSessionClient` in `scripts/acp-session-client.mjs` owns one explicitly configured agent child and implements initialize, one session, text prompts and shutdown. The existing probe/CLI remains initialize-only by default. Actual Codex ACP entry, authentication/login, browser wiring, MCP delegation and model selection are neither implemented nor verified.

Pinned `schema-v1.26.0`, commit `e2d83349bc9e28a4059ea3acefa1c91c966f74e2`; downloaded 255170 bytes matched SHA256 `4bcd1d2051ff7ed379bd9b234fb9b09c5ab9245478698e9fab805bd9b52a33a6`. Primary references: [setup](https://agentclientprotocol.com/protocol/v1/session-setup), [prompt/cancel](https://agentclientprotocol.com/protocol/v1/prompt-turn), [fixed schema](https://github.com/agentclientprotocol/agent-client-protocol/releases/download/schema-v1.26.0/schema.json). Do not mix v2 draft semantics.

## Contract

`start()` reaches initialized, not authenticated. `newSession(absoluteCwd)` creates one session with no MCP servers. Ready permits one `prompt(text)`; return `{stopReason,text,updateCount,cancelled}`. Diagnostics never contain conversation text, argv, environment or raw remote errors. Text is available only as the explicit prompt result.

UTF-8 limits: 16KiB prompt, 64KiB record, 128 notifications and 64KiB retained text per turn. Request default 30 seconds, configurable 1..120000ms; cancellation acknowledgement default 2 seconds. Invalid UTF-8/envelopes, unknown identities, oversized updates, malformed responses and stdin backpressure stop the child. Known non-text updates count toward limits but are not adopted; thoughts are never copied into the response. Unadvertised notice/compaction notifications are refused. Filesystem/terminal requests receive method-not-found; permission requests always receive cancelled, never tool grants.

Cancellation discards text, awaits cancelled and closes the owned child. Reuse requires a new client; normal completion allows the next prompt. Because v1 notifications have no turn ID, there is no general attribution guarantee for an agent that violates the protocol by sending old content after normal completion during a new turn.

`close()` is idempotent, settles active prompts as cancelled, and prevents late initialize/new responses from becoming ready. It uses the existing EOF/grace/kill/close ownership lifecycle; descendant process-tree cleanup is not claimed. Timers/listeners/pending requests and retained text are released.

## Tests

`node --test tests/acp-client-process.test.mjs tests/acp-session-client.test.mjs`: 52 passed. Real synthetic Node subprocesses cover Unicode, repeated prompts, concurrent refusal, late cancellation text, ignored EOF, timeouts, exit, malformed/oversized replies, refused client requests, close races and a new-session response plus immediate notification in one chunk. No real agent/authentication/GUI or parent completion is claimed.
