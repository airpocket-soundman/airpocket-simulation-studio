import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserConnectionErrorMessage} from '../src/browser-connection-errors.js';
test('connection fetch failures explain several possible causes in Japanese and English without claiming a cause',()=>{
 const ja='ローカル接続に到達できません。接続プログラムの起動、ブラウザー/アプリのローカルネットワーク許可、接続元URLの一致を確認してください。';
 for(const message of ['Failed to fetch','TypeError: Failed to fetch','fetch failed','NetworkError when attempting to fetch resource.','Load failed']){
  assert.equal(browserConnectionErrorMessage(message),ja);assert.match(browserConnectionErrorMessage(message,'en'),/^Cannot reach the local connector\./);assert.match(browserConnectionErrorMessage(message,'en'),/origin URL matches/);
 }
});
test('unknown technical errors retain bounded detail and ordinary disconnection stays unchanged',()=>{
 for(const language of ['ja','en']){assert.equal(browserConnectionErrorMessage('Browser bridge refused (403)',language),'Browser bridge refused (403)');assert.equal(browserConnectionErrorMessage('x'.repeat(3000),language).length,2048);}
 assert.equal(browserConnectionErrorMessage(), '未接続');assert.equal(browserConnectionErrorMessage('', 'en'),'Disconnected');assert.equal(browserConnectionErrorMessage(null),'未接続');assert.equal(browserConnectionErrorMessage({token:'never reflect'}),'未接続');
});
