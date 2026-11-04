import {identifyPrintedParameters} from './printed-parameter-identification.js';
// One owned worker per request. Never mutates project, material, case or solver input.
if(typeof self!=='undefined')self.onmessage=async ({data})=>{
 try {
  if(!data||typeof data.raw!=='string'||!Number.isSafeInteger(data.requestId))throw Error('request');
  const result=await identifyPrintedParameters(data.raw,data.options);
  self.postMessage({requestId:data.requestId,ok:true,result});
 } catch(error){self.postMessage({requestId:data?.requestId,ok:false,code:error?.code==='PRINTED_DATASET_INVALID'?'PRINTED_DATASET_INVALID':'PRINTED_IDENTIFICATION_INVALID'});}
};
