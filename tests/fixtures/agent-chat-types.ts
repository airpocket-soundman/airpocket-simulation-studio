import {createAgentChatState} from '../../src/agent-chat-state.js';
import {createAgentChatPanel} from '../../src/ui/agent-chat-panel.js';
import {AcpSessionClient} from '../../scripts/acp-session-client.mjs';
const model=createAgentChatState();
declare const client:AcpSessionClient;
model.setProvider(client);
// @ts-expect-error prompt accepts text only, never attachment records
model.send({attachment:'x'});
// @ts-expect-error initialization probe is not a session provider
model.setProvider({describe:()=>({state:'ready'})});
const panel=createAgentChatPanel({host:document.body});panel.setProvider(client);
const production:false=panel.snapshot().productionTransport;
void production;
