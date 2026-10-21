// Read-only connection status panel. It maps the existing connection events (and, separately, an
// optional ACP initialization probe) to display text. It opens no connection, reads no token, keeps
// no storage and starts no timer, so elapsed time or a button click never becomes "connected".
// Every dependency is injected; this module imports nothing.
export const CONNECTION_UI_STATES=Object.freeze(['disconnected','connecting','connected','expired','failed']);
export const ACP_UI_STATES=Object.freeze(['unavailable','initializing','initialized','stopping','stopped','failed']);
export const CONNECTION_SCOPES=Object.freeze(['inspect','edit','analyze','view']);
export const AGENT_CONNECTION_STATUS_TRANSLATIONS=Object.freeze({
 '接続状態':'Connection status','接続方式':'Connection method','状態':'State','次に必要な操作':'Next required action',
 'ローカル接続プログラム（この端末のループバックHTTPのみ）':'Local connector (loopback HTTP on this device only)',
 '未接続':'Disconnected','接続しています…':'Connecting…','接続中':'Connected','接続の有効期限が切れました':'The connection expired','接続に失敗しました':'The connection failed',
 '上の「選んだ操作を許可して接続」で接続してください。':'Use “Allow selected operations and connect” above to connect.',
 '接続結果の通知を待っています。時間の経過では接続済みにしません。':'Waiting for the connection result notification. Elapsed time never marks the connection as established.',
 '終えるときは上の「接続を解除」で切断してください。':'Use “Disconnect” above when finished.',
 '上の「接続を解除」で片付けてから、もう一度接続してください。':'Clean up with “Disconnect” above, then connect again.',
 '上の「接続を診断」で接続先を確認し、起動と許可を見直してから、もう一度接続してください。':'Review the endpoint with “Diagnose connection” above, recheck the connector startup and local-network permission, then connect again.',
 '接続結果にセッション識別子がありません。時間の経過では接続済みにしません。':'The connection result carried no session identity. Elapsed time never marks the connection as established.',
 '許可済みの操作':'Permitted operations','未許可の操作':'Operations not permitted',
 '許可済みの操作はまだありません。':'No operations are permitted yet.','未許可の操作はありません。':'No operations are excluded.',
 '許可範囲は接続時に選んだ4項目だけです。この表示から自動で増やしません。':'Only the four items selected when connecting are permitted. This display never adds any.',
 '入力・結果の確認':'Inspect input and results','入力・保存ケースの編集':'Edit inputs and saved cases','計算・結果の表示と保存':'Calculate and show/save results','表示・画像動画出力':'View settings and media export',
 'AIエージェント連携（ACP）':'AI agent connection (ACP)','未対応（初期化probeはまだ導入されていません）':'Not supported (the initialization probe is not installed yet)',
 '初期化中':'Initializing','初期化済み・会話/認証未確認':'Initialized; conversation and authentication unverified','停止中':'Stopping','停止済み':'Stopped','初期化に失敗':'Initialization failed',
 'ACPの状態は接続方式とは別です。会話・認証・モデル選択はまだ実装していません。':'ACP state is separate from the connector connection. Conversation, authentication and model selection are not implemented yet.',
 '接続状態の通知':'Connection status notifications','接続しています。':'Connecting.','接続しました。':'Connected.','接続を解除しました。':'Disconnected.',
 '接続の有効期限が切れました。':'The connection expired.','接続に失敗しました。':'The connection failed.'
});
const CONNECTION_METHOD='ローカル接続プログラム（この端末のループバックHTTPのみ）';
const SCOPE_LABELS=Object.freeze({inspect:'入力・結果の確認',edit:'入力・保存ケースの編集',analyze:'計算・結果の表示と保存',view:'表示・画像動画出力'});
const CONNECTION_LABELS=Object.freeze({disconnected:'未接続',connecting:'接続しています…',connected:'接続中',expired:'接続の有効期限が切れました',failed:'接続に失敗しました'});
const CONNECTION_ACTIONS=Object.freeze({disconnected:'上の「選んだ操作を許可して接続」で接続してください。',connecting:'接続結果の通知を待っています。時間の経過では接続済みにしません。',connected:'終えるときは上の「接続を解除」で切断してください。',expired:'上の「接続を解除」で片付けてから、もう一度接続してください。',failed:'上の「接続を診断」で接続先を確認し、起動と許可を見直してから、もう一度接続してください。'});
const ACP_LABELS=Object.freeze({unavailable:'未対応（初期化probeはまだ導入されていません）',initializing:'初期化中',initialized:'初期化済み・会話/認証未確認',stopping:'停止中',stopped:'停止済み',failed:'初期化に失敗'});
const LIVE_ANNOUNCEMENTS=Object.freeze({connecting:'接続しています。',connected:'接続しました。',disconnected:'接続を解除しました。',expired:'接続の有効期限が切れました。',failed:'接続に失敗しました。'});
const UNKNOWN_SESSION_ACTION='接続結果にセッション識別子がありません。時間の経過では接続済みにしません。';
export const ACP_SEPARATE_NOTE='ACPの状態は接続方式とは別です。会話・認証・モデル選択はまだ実装していません。';

function normalizeScopes(scopes){if(!Array.isArray(scopes))return [];return CONNECTION_SCOPES.filter(scope=>scopes.includes(scope));}
/** Existing connection events -> read-only UI state. Unknown or malformed events return null so the caller keeps the previous state. */
export function connectionStatusFromEvent(event){
 if(event===undefined||event===null)return {state:'disconnected',sessionId:null,scopes:[],message:'',reason:null};
 if(typeof event!=='object'||Array.isArray(event))return null;
 const message=typeof event.message==='string'?event.message.slice(0,2048):'';
 const hasMessage=event.message!==undefined&&event.message!==null&&event.message!=='';
 if(event.state==='connecting')return {state:'connecting',sessionId:null,scopes:[],message,reason:null};
 if(event.state==='connected'){
  if(typeof event.sessionId!=='string'||!event.sessionId)return {state:'failed',sessionId:null,scopes:[],message:'',reason:'missing-session-identity'};
  return {state:'connected',sessionId:event.sessionId.slice(0,128),scopes:normalizeScopes(event.scopes),message:'',reason:null};
 }
 if(event.state==='disconnected')return {state:hasMessage?'failed':'disconnected',sessionId:null,scopes:[],message,reason:null};
 if(event.state==='expired')return {state:'expired',sessionId:null,scopes:[],message,reason:null};
 if(event.state==='failed')return {state:'failed',sessionId:null,scopes:[],message,reason:null};
 return null;
}
/** ACP is its own lane. Absent or unknown probes stay unavailable and never become a connected browser session. */
export function acpStatusFromProbe(probe){
 if(probe===undefined||probe===null)return {state:'unavailable',conversationVerified:false,authenticated:false};
 if(typeof probe!=='object'||Array.isArray(probe)||!ACP_UI_STATES.includes(probe.state))return null;
 return {state:probe.state,conversationVerified:false,authenticated:false};
}
export function createAgentConnectionStatusUi({host,document:doc=globalThis.document,language=()=> 'ja',translate=()=>{},errorMessage=(message)=>typeof message==='string'?message.slice(0,2048):''}={}){
 if(!host||typeof host.append!=='function')throw Error('A connection status host is required');
 const tr=text=>language()==='en'?(AGENT_CONNECTION_STATUS_TRANSLATIONS[text]??text):text;
 translate(AGENT_CONNECTION_STATUS_TRANSLATIONS);
 const element=(tag,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 const panel=element('div');panel.id='agent-connection-status';panel.setAttribute('role','group');panel.setAttribute('aria-labelledby','agent-connection-status-heading');
 const heading=element('h4');heading.id='agent-connection-status-heading';const list=element('dl');
 const row=valueId=>{const label=element('dt'),value=element('dd');value.id=valueId;list.append(label,value);return {label,value};};
 const method=row('agent-connection-method'),phase=row('agent-connection-phase'),next=row('agent-connection-next'),permitted=row('agent-connection-scopes'),denied=row('agent-connection-scopes-denied');
 const scopeNote=element('p');scopeNote.id='agent-connection-scope-note';
 const acp=element('p');acp.id='agent-connection-acp';
 const live=element('p');live.id='agent-connection-status-live';live.setAttribute('role','status');live.setAttribute('aria-live','polite');
 panel.append(heading,list,scopeNote,acp,live);host.append(panel);
 const captions=[[heading,'接続状態'],[method.label,'接続方式'],[phase.label,'状態'],[next.label,'次に必要な操作'],[permitted.label,'許可済みの操作'],[denied.label,'未許可の操作']];
 let connection=connectionStatusFromEvent(undefined),acpState=acpStatusFromProbe(undefined),active=true,rendered=null;
 const onLanguageChange=()=>render();
 const subscribed=typeof doc?.addEventListener==='function'&&typeof doc?.removeEventListener==='function';
 if(subscribed)doc.addEventListener('studio-language',onLanguageChange);
 function detailText(){if(typeof connection.message!=='string'||!connection.message)return '';return String(errorMessage(connection.message,language())).slice(0,2048);}
 function render(){
  if(!active)return false;
  const signature=JSON.stringify([language()==='en',connection,acpState]);
  if(signature===rendered)return false;
  rendered=signature;
  const english=language()==='en',separator=english?', ':'、';
  for(const [node,key] of captions)node.textContent=tr(key);
  method.value.textContent=tr(CONNECTION_METHOD);
  const detail=connection.state==='failed'?detailText():'';
  phase.value.textContent=tr(CONNECTION_LABELS[connection.state])+(detail?' — '+detail:'');
  next.value.textContent=tr(connection.state==='failed'&&connection.reason==='missing-session-identity'?UNKNOWN_SESSION_ACTION:CONNECTION_ACTIONS[connection.state]);
  const allowed=normalizeScopes(connection.scopes),blocked=CONNECTION_SCOPES.filter(scope=>!allowed.includes(scope));
  permitted.value.textContent=allowed.length?allowed.map(scope=>tr(SCOPE_LABELS[scope])).join(separator):tr('許可済みの操作はまだありません。');
  denied.value.textContent=blocked.length?blocked.map(scope=>tr(SCOPE_LABELS[scope])).join(separator):tr('未許可の操作はありません。');
  scopeNote.textContent=tr('許可範囲は接続時に選んだ4項目だけです。この表示から自動で増やしません。');
  acp.textContent=tr('AIエージェント連携（ACP）')+': '+tr(ACP_LABELS[acpState.state])+' '+tr(ACP_SEPARATE_NOTE);
  live.textContent=LIVE_ANNOUNCEMENTS[connection.state]?tr(LIVE_ANNOUNCEMENTS[connection.state])+(connection.state==='failed'&&detail?' — '+detail:''):'';
  // Attribute ownership: installLanguage's scanner keeps the first attribute value it sees as the
  // translation source. Writing an already-translated value here would freeze "Connection status
  // notifications" as that source on an EN start and every later scan would restore English over JP.
  // So the attribute is always the JP source and translation is delegated to the scanner, the same
  // way static markup is handled.
  live.setAttribute('aria-label','接続状態の通知');
  return true;
 }
 render();
 return Object.freeze({
  report(event){if(!active)return false;const mapped=connectionStatusFromEvent(event);if(!mapped)return false;connection=mapped;return render();},
  setAcp(probe){if(!active)return false;const mapped=acpStatusFromProbe(probe);if(!mapped)return false;acpState=mapped;return render();},
  refresh(){return render();},
  state(){return {connection:{...connection,scopes:[...connection.scopes]},acp:{...acpState}};},
  teardown(){active=false;rendered=null;if(subscribed)doc.removeEventListener('studio-language',onLanguageChange);return true;}
 });
}
