export function webmTestEnv(){
 let time=0,id=0;const pending=new Map(),document=Object.assign(new EventTarget(),{hidden:false,visibilityState:'visible',documentElement:{lang:'en'}});
 const env={document,now:()=>time,setTimeout(fn,delay){const key=++id;pending.set(key,{at:time+delay,fn});return key;},clearTimeout(key){pending.delete(key);}};
 return {env,document,get timers(){return pending.size;},hide(){document.hidden=true;document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));},advance(ms){time+=ms;for(;;){const next=[...pending].find(([,v])=>v.at<=time);if(!next)break;pending.delete(next[0]);next[1].fn();}}};
}
