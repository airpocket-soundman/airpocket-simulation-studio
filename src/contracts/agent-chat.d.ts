export type AgentChatPhase='unavailable'|'idle'|'starting'|'initialized'|'creating'|'ready'|'prompting'|'cancelling'|'closing'|'closed'|'failed'|'authentication-required';
export interface AgentChatProvider {
 describe():{state:string};
 prompt(text:string):Promise<{text:string;cancelled:boolean}>;
 cancel():unknown;
}
export interface AgentChatSnapshot {
 phase:AgentChatPhase;canSend:boolean;canStop:boolean;failureCode:string|null;
 messages:Array<{role:'user'|'assistant';text:string}>;productionTransport:false;
}
export interface AgentChatState {
 snapshot():AgentChatSnapshot;setProvider(provider:AgentChatProvider|null):AgentChatSnapshot;
 send(text:string):Promise<boolean>;stop():Promise<boolean>;refresh():AgentChatSnapshot;destroy():void;
}
export declare const AGENT_CHAT_LIMITS:Readonly<{promptBytes:16384;responseBytes:65536;historyBytes:131072;messages:16}>;
export declare function createAgentChatState(options?:{onChange?:(state:AgentChatSnapshot)=>void}):AgentChatState;
export declare function createAgentChatPanel(options:{host:HTMLElement;document?:Document;language?:()=>string}):{
 model:AgentChatState;input:HTMLTextAreaElement;send:HTMLButtonElement;stop:HTMLButtonElement;
 status:HTMLParagraphElement;reason:HTMLParagraphElement;history:HTMLDivElement;refresh():void;
 setProvider(provider:AgentChatProvider|null):AgentChatSnapshot;snapshot():AgentChatSnapshot;destroy():void;
};
