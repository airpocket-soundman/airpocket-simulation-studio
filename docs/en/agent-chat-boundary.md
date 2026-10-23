# Chat panel session boundary

[日本語](../agent-chat-boundary.md)

This bounded instruction55 implementation separates a DOM-free `createAgentChatState` from `createAgentChatPanel`. Only an explicitly supplied describe/prompt/cancel provider can enable sending. The existing Node `AcpSessionClient` works through this interface in real synthetic subprocess tests. Browser transport, real AI authentication, model selection and MCP delegation are not implemented. An unusable chat panel is not mounted in main.

States distinguish unavailable, idle, initialization, session creation, ready, prompting, cancellation, closing, closed, failure and authentication required. One prompt is admitted only in ready. Stop waits for the pending prompt to settle after cancellation. ACP cancellation closes its child; a new conversation requires a new explicit client. The caller starts/authenticates its provider and calls refresh after external state changes.

Limits are16 KiB UTF-8 prompt,64 KiB response,128 KiB/16 messages retained. Empty input is refused. Oversized replies fail rather than truncate. Oldest messages are evicted. Only textContent renders messages; raw errors are replaced with fixed codes. There is no persistence, automatic retry, attachment handling or transport in this boundary.

Replacing an active provider or cancelling retires that object: adopting it again is refused, preventing obsolete cancellation effects on a fresh A→B→A turn. A new provider is required. Session changes, cancellation and disposal invalidate generations; obsolete replies and cancellation errors cannot update a newer session. A new draft survives the previous response. UI requests cancellation of active work but does not close a client owned by its caller. A nonconforming provider that ignores cancellation has no general termination guarantee; the existing bounded ACP client is the supported integration.

DOM fixtures verify Japanese/English labels, live status, plain text, disabled controls and draft preservation. Standard textarea/buttons and wrapping styles support integration. Real Chrome,390px and production connection acceptance remain unverified. Parent AGENTCHAT1/AGENTACP1 states remain unfinished.
