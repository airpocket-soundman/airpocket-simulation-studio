// Synthetic deployed-module protocol fixture. No solver or WASM is executed.
globalThis.self.onmessage=async({data})=>{
 if(data.scenario==='stall')await new Promise(()=>{});
 if(data.scenario==='throw')throw Error('Synthetic deployed module refusal');
 globalThis.self.postMessage({result:{synthetic:true,pid:process.pid,executable:process.execPath,operation:data.operation,buffer:data.buffer,options:data.options}});
};
