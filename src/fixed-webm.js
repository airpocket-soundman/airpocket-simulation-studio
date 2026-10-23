// Deliberately narrow WebM: VP8, one video track, every frame a keyframe,
// finite EBML sizes, one SimpleBlock per Cluster, no lacing/audio/encryption.
export const FIXED_WEBM_LIMITS=Object.freeze({frames:120,bytes:32*1024*1024,width:1280,height:640,seconds:15,queue:2});
export function fixedWebmError(code,message){return Object.assign(Error(message),{code});}
const fail=message=>{throw fixedWebmError('WEBM_FIXED_INVALID',message);};
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
export function fixedWebmSchedule(seconds){
 if(!integer(seconds,1,15))fail('Fixed WebM seconds must be an integer from 1 through 15');
 const count=Math.min(seconds*24,FIXED_WEBM_LIMITS.frames),total=seconds*1000000;
 return Array.from({length:count},(_,index)=>({index,phase:index/(count-1),timestamp:Math.round(index*total/count),duration:Math.round((index+1)*total/count)-Math.round(index*total/count)}));
}
function dataObject(value,keys){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length||keys.some(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return !d||!d.enumerable||!('value'in d);}))fail('Invalid fixed WebM record');
}
const abLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
const typed=Object.getPrototypeOf(Uint8Array.prototype),typedBuffer=Object.getOwnPropertyDescriptor(typed,'buffer').get,typedLength=Object.getOwnPropertyDescriptor(typed,'byteLength').get,typedSet=Uint8Array.prototype.set;
function snapshot(value){
 if(!value||Object.getPrototypeOf(value)!==Uint8Array.prototype)fail('Fixed WebM requires an ordinary Uint8Array');
 let length;try{abLength.call(typedBuffer.call(value));length=typedLength.call(value);}catch{fail('Shared or invalid fixed WebM bytes');}
 if(!integer(length,1,FIXED_WEBM_LIMITS.bytes))fail('Fixed WebM byte bound exceeded');
 const copy=new Uint8Array(length);typedSet.call(copy,value);return copy;
}
const join=parts=>{const n=parts.reduce((n,p)=>n+p.length,0);if(n>FIXED_WEBM_LIMITS.bytes)fail('Fixed WebM byte bound exceeded');const out=new Uint8Array(n);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const id=hex=>Uint8Array.from(hex.match(/../g).map(s=>parseInt(s,16)));
function uint(n){if(!integer(n,0,Number.MAX_SAFE_INTEGER))fail('Invalid EBML integer');const a=[];do{a.unshift(n%256);n=Math.floor(n/256);}while(n);return Uint8Array.from(a);}
function size(n){for(let length=1;length<=4;length++)if(n<2**(7*length)-1){const a=new Uint8Array(length);let x=n;for(let i=length-1;i>=0;i--){a[i]=x%256;x=Math.floor(x/256);}a[0]|=1<<(8-length);return a;}fail('EBML size bound exceeded');}
const element=(name,payload)=>join([id(name),size(payload.length),payload]);
const u=(name,n)=>element(name,uint(n));
const text=(name,s)=>element(name,new TextEncoder().encode(s));
function f64(n){const a=new Uint8Array(8);new DataView(a.buffer).setFloat64(0,n);return a;}
function validatePlan({width,height,seconds,packets}){
 if(!integer(width,1,1280)||!integer(height,1,640))fail('Fixed WebM dimensions exceed 1280 by 640');
 const plan=fixedWebmSchedule(seconds);
 if(!Array.isArray(packets)||Object.getPrototypeOf(packets)!==Array.prototype||packets.length!==plan.length||Reflect.ownKeys(packets).length!==packets.length+1)fail('Fixed WebM packet count differs from schedule');
 let retained=0;
 const owned=plan.map((entry,i)=>{const d=Object.getOwnPropertyDescriptor(packets,String(i));if(!d||!('value'in d))fail('Invalid fixed WebM packet array');const p=d.value;dataObject(p,['timestamp','duration','type','data']);if(p.timestamp!==entry.timestamp||p.duration!==entry.duration||p.type!=='key')fail('Fixed WebM packet identity differs from schedule');const bytes=snapshot(p.data);retained+=bytes.length;if(retained>FIXED_WEBM_LIMITS.bytes-65536)fail('Fixed WebM encoded byte budget exceeded');return {...entry,data:bytes};});
 return owned;
}
export function muxFixedWebm(args){
 dataObject(args,['width','height','seconds','packets']);const {width,height,seconds}=args,packets=validatePlan(args);
 const header=element('1a45dfa3',join([u('4286',1),u('42f7',1),u('42f2',4),u('42f3',8),text('4282','webm'),u('4287',2),u('4285',2)]));
 // TimestampScale=1000ns => integer microsecond Cluster timestamps. Relative block time=0.
 const info=element('1549a966',join([u('2ad7b1',1000),element('4489',f64(seconds*1000000)),text('4d80','airpocket-fixed-vp8'),text('5741','airpocket-fixed-vp8')]));
 const track=element('1654ae6b',element('ae',join([u('d7',1),u('73c5',1),u('83',1),u('9c',0),text('86','V_VP8'),u('23e383',packets[0].duration*1000),element('e0',join([u('b0',width),u('ba',height)]))])));
 const clusters=packets.map(p=>element('1f43b675',join([u('e7',p.timestamp),element('a3',join([Uint8Array.of(0x81,0,0,0x80),p.data]))])));
 return join([header,element('18538067',join([info,track,...clusters]))]);
}

// Strict reader of exactly this producer's profile. Never scans for byte signatures.
export function demuxFixedWebm(raw){
 const bytes=snapshot(raw),view=new DataView(bytes.buffer);let elements=0;
 function children(start,end){const out=[];while(start<end){if(++elements>1024)fail('Fixed WebM element capacity exceeded');let length=1,mask=0x80;while(length<=4&&!(bytes[start]&mask)){length++;mask>>=1;}if(length>4||start+length>=end)fail('Invalid EBML identifier');let name='';for(let i=0;i<length;i++)name+=bytes[start+i].toString(16).padStart(2,'0');start+=length;let n=1,bit=0x80;while(n<=4&&!(bytes[start]&bit)){n++;bit>>=1;}if(n>4||start+n>end)fail('Invalid EBML size');let count=bytes[start]& (bit-1);for(let i=1;i<n;i++)count=count*256+bytes[start+i];if(count===2**(7*n)-1||(n>1&&count<2**(7*(n-1))-1))fail('Noncanonical EBML size');start+=n;if(start+count>end)fail('Truncated EBML payload');out.push({name,start,end:start+count});start+=count;}if(start!==end)fail('Invalid EBML boundary');return out;}
 function exact(list,names){if(list.length!==names.length||list.some((e,i)=>e.name!==names[i]))fail('Unsupported or duplicate fixed WebM elements');}
 function number(e){if(e.end-e.start<1||e.end-e.start>7||(e.end-e.start>1&&bytes[e.start]===0))fail('Noncanonical EBML integer');let n=0;for(let i=e.start;i<e.end;i++)n=n*256+bytes[i];if(!Number.isSafeInteger(n))fail('EBML integer overflow');return n;}
 const string=e=>new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(e.start,e.end));
 const root=children(0,bytes.length);exact(root,['1a45dfa3','18538067']);const h=children(root[0].start,root[0].end);exact(h,['4286','42f7','42f2','42f3','4282','4287','4285']);if(h.map((e,i)=>i===4?string(e):number(e)).join(',')!=='1,1,4,8,webm,2,2')fail('Unsupported WebM header');
 const segment=children(root[1].start,root[1].end);if(segment.length<3||segment.length>122||segment[0].name!=='1549a966'||segment[1].name!=='1654ae6b'||segment.slice(2).some(e=>e.name!=='1f43b675'))fail('Unsupported fixed WebM segment');
 const info=children(segment[0].start,segment[0].end);exact(info,['2ad7b1','4489','4d80','5741']);if(number(info[0])!==1000||info[1].end-info[1].start!==8||string(info[2])!=='airpocket-fixed-vp8'||string(info[3])!=='airpocket-fixed-vp8')fail('Unsupported fixed WebM metadata');const duration=view.getFloat64(info[1].start),seconds=duration/1000000,plan=fixedWebmSchedule(seconds);
 const tracks=children(segment[1].start,segment[1].end);exact(tracks,['ae']);const t=children(tracks[0].start,tracks[0].end);exact(t,['d7','73c5','83','9c','86','23e383','e0']);if(number(t[0])!==1||number(t[1])!==1||number(t[2])!==1||number(t[3])!==0||string(t[4])!=='V_VP8'||number(t[5])!==plan[0].duration*1000)fail('Unsupported VP8 track');const video=children(t[6].start,t[6].end);exact(video,['b0','ba']);const width=number(video[0]),height=number(video[1]);if(!integer(width,1,1280)||!integer(height,1,640)||segment.length-2!==plan.length)fail('Invalid fixed WebM dimensions/count');
 const packets=segment.slice(2).map((cluster,i)=>{const c=children(cluster.start,cluster.end);exact(c,['e7','a3']);if(number(c[0])!==plan[i].timestamp||c[1].end-c[1].start<5||bytes[c[1].start]!==0x81||bytes[c[1].start+1]!==0||bytes[c[1].start+2]!==0||bytes[c[1].start+3]!==0x80)fail('Invalid fixed WebM keyframe identity');return {timestamp:plan[i].timestamp,duration:plan[i].duration,type:'key',data:bytes.subarray(c[1].start+4,c[1].end)};});
 return {width,height,seconds,packets};
}
