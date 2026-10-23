export type AcpSessionState='idle'|'starting'|'initialized'|'creating'|'ready'|'prompting'|'cancelling'|'closing'|'closed'|'failed';
export interface AcpSessionConfig {executable:string;argv:string[];cwd:string;initializeTimeoutMs?:number;stopGraceMs?:number;forceKillWaitMs?:number;installSignalHandlers?:boolean;}
export interface AcpSessionOptions {requestTimeoutMs?:number;cancelTimeoutMs?:number;}
export interface AcpSessionDescription {state:AcpSessionState;sessionCreated:boolean;activePrompt:boolean;cancelling:boolean;failureCode:string|null;authentication:'not-performed';realAgentVerified:false;}
export interface AcpPromptResult {readonly stopReason:'end_turn'|'max_tokens'|'max_turn_requests'|'refusal'|'cancelled';readonly text:string;readonly updateCount:number;readonly cancelled:boolean;}
export interface AcpSessionClose {exited:boolean;forced:boolean;failureCode:string|null;}
