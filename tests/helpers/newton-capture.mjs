// Opt-in capture of Newton/line-search failures. Off unless AIRPOCKET_CAPTURE_DIR is set;
// when unset it returns no options, so solver behaviour is exactly unchanged.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
export function captureOptions(label,dir=process.env.AIRPOCKET_CAPTURE_DIR){
 if(!dir)return {};
 return {onFailure(record){
  mkdirSync(dir,{recursive:true});
  const name=`${label}-${process.pid}-${Date.now()}.json`.replace(/[^\w.-]/g,'_');
  writeFileSync(join(dir,name),JSON.stringify({label,pid:process.pid,capturedAt:new Date().toISOString(),...record}));
 }};
}
