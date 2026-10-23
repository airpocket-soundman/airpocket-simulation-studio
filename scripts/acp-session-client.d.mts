import type {AcpSessionConfig,AcpSessionOptions,AcpSessionState,AcpSessionDescription,AcpPromptResult,AcpSessionClose} from '../src/contracts/acp-session.js';
export declare const ACP_SESSION_LIMITS: Readonly<{promptBytes:16384;textBytes:65536;updates:128;recordBytes:65536;requestTimeoutMs:30000;cancelTimeoutMs:2000}>;
export declare const ACP_SESSION_REFERENCE: Readonly<{tag:string;schemaSha256:string;schemaUrl:string;commitSha:string;retrievedAt:string}>;
export declare class AcpSessionClient {
 constructor(config:AcpSessionConfig,options?:AcpSessionOptions);
 get state():AcpSessionState;
 describe():AcpSessionDescription;
 diagnostics():AcpSessionDescription & {transport:{state:string;activeChild:boolean;activeTimers:number;pendingRequests:number;stdoutRetainedBytes:number;stderrRetainedBytes:number;stderrTruncated:boolean;signalHandlersInstalled:boolean};retainedTextBytes:number;retainedUpdates:number;cancelTimerActive:boolean;earlyUpdateCount:number};
 start():Promise<AcpSessionDescription>;
 newSession(cwd:string):Promise<AcpSessionDescription>;
 prompt(text:string):Promise<AcpPromptResult>;
 cancel():boolean;
 close():Promise<AcpSessionClose>;
}
