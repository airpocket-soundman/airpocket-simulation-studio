export function orbitGifEnv(){
 const stats={canvases:[],draws:[],yields:0};
 const createCanvas=()=>{let width=0,height=0,data=new Uint8ClampedArray();const ensure=()=>{if(data.length!==width*height*4)data=new Uint8ClampedArray(width*height*4);};let fillStyle='#102331';const canvas={get width(){return width;},set width(v){width=v;data=new Uint8ClampedArray();},get height(){return height;},set height(v){height=v;data=new Uint8ClampedArray();},getContext(){return context;}};
  const color=()=>/^#[a-f0-9]{6}$/i.test(fillStyle)?[parseInt(fillStyle.slice(1,3),16),parseInt(fillStyle.slice(3,5),16),parseInt(fillStyle.slice(5,7),16)]:[0,0,0];
  const rectangle=(x,y,w,h,c)=>{ensure();for(let j=Math.max(0,Math.floor(y));j<Math.min(height,Math.ceil(y+h));j++)for(let i=Math.max(0,Math.floor(x));i<Math.min(width,Math.ceil(x+w));i++)data.set([...c,255],(j*width+i)*4);};
  const context={get fillStyle(){return fillStyle;},set fillStyle(v){fillStyle=v;},fillRect(x,y,w,h){rectangle(x,y,w,h,color());},drawImage(source,x,y,w,h){stats.draws.push({x,y,width:w,height:h,sourceWidth:source.width,sourceHeight:source.height});rectangle(x,y,w,h,source.color??[42,80,120]);},getImageData(){ensure();return {data:new Uint8ClampedArray(data)};}};
  stats.canvases.push(canvas);return canvas;
 };
 return {stats,env:{createCanvas,yieldControl:async()=>{stats.yields++;}}};
}
