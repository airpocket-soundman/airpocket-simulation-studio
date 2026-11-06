const fail=()=>{throw Object.assign(Error('Invalid bounded saved report JSON'),{code:'PRINTED_SLS_REPORT_INVALID'});};
/** Strict saved JSON, not an instruction source. Duplicate decoded keys and non-XML strings refuse. */
export function parsePrintedSlsReportJson(text){
 if(typeof text!=='string'||text.length>4194304||new TextEncoder().encode(text).length>4194304)fail();
 let at=0,count=0;const ws=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!'))at++;};
 function string(){const start=at++;for(;at<text.length;at++){if(text[at]==='"'){at++;let s;try{s=JSON.parse(text.slice(start,at));}catch{fail();}if(s.length>4096)fail();for(const c of s){const n=c.codePointAt(0);if(n<32&&![9,10,13].includes(n)||n>=0xd800&&n<=0xdfff||n===0xfffe||n===0xffff)fail();}return s;}if(text[at]==='\\')at++;}fail();}
 function value(depth){if(depth>16||++count>400000)fail();ws();const c=text[at];if(c==='"')return string();if(c==='{'||c==='['){const object=c==='{',x=object?Object.create(null):[],seen=new Set();at++;ws();if(text[at]===(object?'}':']')){at++;return x;}for(;;){ws();if(object){if(text[at]!=='"')fail();const k=string();if(seen.has(k)||seen.size>=64)fail();seen.add(k);ws();if(text[at++]!==':')fail();x[k]=value(depth+1);}else{if(x.length>=4096)fail();x.push(value(depth+1));}ws();if(text[at]===(object?'}':']')){at++;return x;}if(text[at++]!==',')fail();}}const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!m)fail();at+=m[0].length;const v=JSON.parse(m[0]);if(typeof v==='number'&&!Number.isFinite(v))fail();return v;}
 const result=value(0);ws();if(at!==text.length)fail();return result;
}
