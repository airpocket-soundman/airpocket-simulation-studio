export function wasmMatvecFactory(instance){return (entries,n)=>{
 let count=0;for(const {ids,k}of entries)for(const v of k)if(v!==0)count++;
 const rows=0,cols=count*4,vals=count*8,x=count*16,y=x+n*8,bytes=y+n*8;
 if(bytes>256*1024*1024)throw Error('WASM matrix memory limit exceeded');
 const {memory,matvec}=instance.exports;if(memory.buffer.byteLength<bytes)memory.grow(Math.ceil((bytes-memory.buffer.byteLength)/65536));
 const r=new Uint32Array(memory.buffer,rows,count),c=new Uint32Array(memory.buffer,cols,count),v=new Float64Array(memory.buffer,vals,count),input=new Float64Array(memory.buffer,x,n),output=new Float64Array(memory.buffer,y,n);let index=0;
 for(const {ids,k}of entries)for(let i=0;i<ids.length;i++)for(let j=0;j<ids.length;j++)if(k[i*ids.length+j]!==0){r[index]=ids[i];c[index]=ids[j];v[index++]=k[i*ids.length+j];}
 return vector=>{input.set(vector);matvec(n,count,rows,cols,vals,x,y);return output;};
};}
