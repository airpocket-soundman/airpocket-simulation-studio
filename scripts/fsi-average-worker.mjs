import {parentPort,workerData} from 'node:worker_threads';
import {runChannelAverageForce} from '../src/fsi-channel-average-force.js';
try{
 const result=runChannelAverageForce(workerData);result.profile=Array.from(result.profile);
 if(Buffer.byteLength(JSON.stringify(result))+1>4194304)throw Object.assign(Error('capacity'),{code:'FSI_AVERAGE_FILE_ARTIFACT_LIMIT'});
 parentPort.postMessage({type:'completed',result});
}catch(e){parentPort.postMessage({type:'failed',code:typeof e?.code==='string'&&/^FSI_AVERAGE_[A-Z0-9_]+$/.test(e.code)?e.code:'FSI_AVERAGE_FILE_COMPUTE'});}
finally{parentPort.close();}
