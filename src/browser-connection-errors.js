// Only an error message is accepted: callers never pass endpoint or pairing credentials.
export function browserConnectionErrorMessage(message,language='ja'){
 const english=language==='en';
 if(typeof message!=='string'||!message)return english?'Disconnected':'未接続';
 const bounded=message.slice(0,2048);
 if(/^(?:TypeError:\s*)?(?:Failed to fetch|fetch failed|NetworkError when attempting to fetch resource\.?|Load failed)$/i.test(bounded))return english?'Cannot reach the local connector. Check that it is running, that your browser or app permits local network access, and that the connection origin URL matches.':'ローカル接続に到達できません。接続プログラムの起動、ブラウザー/アプリのローカルネットワーク許可、接続元URLの一致を確認してください。';
 return bounded;
}
