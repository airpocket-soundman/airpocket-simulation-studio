// WebM recording only. Timers cannot execute while a page is suspended; check again on resume.
export const WEBM_RECORDING_LIMITS=Object.freeze({stallMs:5000,stopMs:2000});
function failure(code,doc){const ja=doc?.documentElement?.lang==='ja';const messages={WEBM_BACKGROUND_INTERRUPTED:ja?'画面が背景に移ったため動画作成を中止しました。画面を表示したまま再実行してください。':'Video creation stopped because this page moved to the background. Keep it visible and retry.',WEBM_PROGRESS_STALLED:ja?'動画の表示更新が止まったため作成を中止しました。画面を表示したまま再実行してください。':'Video creation stopped because frame updates stalled. Keep this page visible and retry.',WEBM_STOP_TIMEOUT:ja?'動画の終了を確認できなかったため作成を中止しました。もう一度実行してください。':'Video creation stopped because recording did not finish. Please retry.'};return Object.assign(Error(messages[code]),{code});}
export function createWebmRecordingLifecycle({onFailure=()=>{},...env}={}){
 const doc=env.document??globalThis.document,now=env.now??(()=>performance.now()),schedule=env.setTimeout??globalThis.setTimeout,clear=env.clearTimeout??globalThis.clearTimeout;
 let last=now(),timer,disposed=false,error,rejectFailure;const interrupted=new Promise((_,reject)=>rejectFailure=reject);interrupted.catch(()=>{});
 const fail=code=>{if(error||disposed)return;error=failure(code,doc);rejectFailure(error);onFailure(error);};
 const check=()=>{if(doc?.hidden===true||doc?.visibilityState==='hidden')fail('WEBM_BACKGROUND_INTERRUPTED');if(!error&&now()-last>=WEBM_RECORDING_LIMITS.stallMs)fail('WEBM_PROGRESS_STALLED');if(error)throw error;};
 const watch=()=>{if(disposed||error)return;try{check();}catch{return;}timer=schedule(watch,Math.max(1,WEBM_RECORDING_LIMITS.stallMs-(now()-last)));};
 const visibility=()=>{try{check();}catch{}};
 check();doc?.addEventListener?.('visibilitychange',visibility);timer=schedule(watch,WEBM_RECORDING_LIMITS.stallMs);
 return {check,progress(){check();last=now();},race(promise){return Promise.race([promise,interrupted]);},dispose(){disposed=true;clear(timer);doc?.removeEventListener?.('visibilitychange',visibility);}};
}
export async function waitForWebmStop(stopped,env={}){
 const schedule=env.setTimeout??globalThis.setTimeout,clear=env.clearTimeout??globalThis.clearTimeout,doc=env.document??globalThis.document;let timer;
 try{return await Promise.race([stopped,new Promise((_,reject)=>{timer=schedule(()=>reject(failure('WEBM_STOP_TIMEOUT',doc)),WEBM_RECORDING_LIMITS.stopMs);})]);}finally{clear(timer);}
}
