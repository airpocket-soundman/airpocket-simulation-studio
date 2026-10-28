import assert from 'node:assert/strict';

// Independent general GIF/LZW decoder used only by tests.
export function decodeGif(bytes){
 let p=6;const word=()=>{const v=bytes[p]|bytes[p+1]<<8;p+=2;return v;},width=word(),height=word(),packed=bytes[p++];p+=2;
 const palette=bytes.slice(p,p+3*(2<<(packed&7)));p+=palette.length;const frames=[];let delay=0,loop;
 const blocks=()=>{const out=[];while(bytes[p]){const n=bytes[p++];out.push(...bytes.slice(p,p+n));p+=n;}p++;return out;};
 while(bytes[p]!==59){const marker=bytes[p++];if(marker===33){const type=bytes[p++];if(type===249){assert.equal(bytes[p++],4);p++;delay=word();p+=2;}else{const data=blocks();if(type===255)loop=data[data.length-2]|data[data.length-1]<<8;}continue;}
  assert.equal(marker,44);const left=word(),top=word(),w=word(),h=word(),flags=bytes[p++];assert.equal(flags,0);assert.equal(left+top,0);
  const minimum=bytes[p++],data=blocks(),clear=1<<minimum,end=clear+1;let dictionary,bits,next,bit=0,previous=null;const pixels=[];
  const reset=()=>{dictionary=Array.from({length:clear},(_,i)=>[i]);bits=minimum+1;next=end+1;previous=null;};reset();
  for(;;){let code=0;for(let i=0;i<bits;i++,bit++)code|=(data[bit>>3]>>(bit&7)&1)<<i;if(code===clear){reset();continue;}if(code===end)break;
   const entry=dictionary[code]??(code===next&&previous?[...previous,previous[0]]:null);assert.ok(entry,'valid LZW code');pixels.push(...entry);
   if(previous){dictionary[next++]=[...previous,entry[0]];if(next===(1<<bits)&&bits<12)bits++;}previous=entry;
  }
  assert.equal(pixels.length,w*h);frames.push({delay,pixels,width:w,height:h});
 }
 assert.equal(p,bytes.length-1);return {width,height,palette,loop,frames};
}