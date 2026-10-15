// Only an error message is accepted: callers never pass endpoint or pairing credentials.
export function browserConnectionErrorMessage(message,language='ja'){
 const english=language==='en';
 if(typeof message!=='string'||!message)return english?'Disconnected':'未接続';
 const bounded=message.slice(0,2048);
 if(/^(?:TypeError:\s*)?(?:Failed to fetch|fetch failed|NetworkError when attempting to fetch resource\.?|Load failed)$/i.test(bounded))return english?'Cannot reach the local connector. Check that it is running, that your browser or app permits local network access, and that the connection origin URL matches.':'ローカル接続に到達できません。接続プログラムの起動、ブラウザー/アプリのローカルネットワーク許可、接続元URLの一致を確認してください。';
 return bounded;
}

export function browserConnectionDiagnosticMessage(result,language='ja'){
 if(!result)return '';
 const english=language==='en';
 const health={reachable:english?'Connector health endpoint reached.':'接続プログラムの診断窓口に到達しました。',unreachable:english?'Health endpoint could not be reached; the cause is undetermined.':'診断窓口に到達できません。原因はまだ特定できません。',timeout:english?'Connection diagnosis timed out.':'接続診断がタイムアウトしました。','invalid-endpoint':english?'Enter an HTTP 127.0.0.1 endpoint without a path or credentials.':'パスや認証情報を含まないHTTP 127.0.0.1の接続先を入力してください。','invalid-response':english?'The endpoint did not return a supported connector health response.':'対応する接続プログラムの診断応答を取得できませんでした。',expired:english?'Connection diagnosis was cancelled.':'接続診断を取り消しました。'};
 const permission=result.permission?.status;
 const states=english?{granted:'granted',denied:'denied',prompt:'prompt',unknown:'unknown',unsupported:'unavailable'}:{granted:'許可',denied:'denied（拒否状態）',prompt:'確認待ち',unknown:'不明',unsupported:'取得非対応'};
 return (health[result.health]??health.unreachable)+' '+(english?'Permission query: ':'権限照会: ')+(states[permission]??states.unknown)+(english?'. This does not identify who denied access or establish authentication or a connected session.':'。この情報だけでは利用者が拒否したかは判断できません。認証やセッション接続の成功を示すものではありません。');
}
