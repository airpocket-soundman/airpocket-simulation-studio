// Deterministic lifecycle test only; this is not a V8 fatal reproduction.
process.on('message',()=>{process.send({phase:'result'});process.send({result:{synthetic:true}},()=>{process.stderr.write('Synthetic late verification failure');process.exit(86);});});
process.send({ready:true});
