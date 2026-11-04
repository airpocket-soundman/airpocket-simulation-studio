import {comparePrintedHoldoutPrediction,PRINTED_HOLDOUT_LIMITS,type PrintedHoldoutResult} from '../../src/printed-parameter-holdout.js';
const common={rawTraining:'{}',rawValidation:'{}',specimenPairs:[{trainingSpecimenId:'train',validationSpecimenId:'holdout'}]};
const result:Promise<PrintedHoldoutResult>=comparePrintedHoldoutPrediction({...common,options:{model:'linear-elastic',maxStrain:.01,minPoints:5,maxRelativeStandardError:.05}});
void result.then(r=>{const calibrated:false=r.calibrated;const verified:false=r.physicalIndependenceVerified;for(const p of r.pairs){if(p.status==='compared'){const stress:number=p.samples[0].predictedStressPa;void stress;}else{const reason:string=p.reason;void reason;}}void calibrated;void verified;});
const budget:100=PRINTED_HOLDOUT_LIMITS.pairs;void budget;
// @ts-expect-error A bilinear fit requires an explicit tangent-ratio threshold.
comparePrintedHoldoutPrediction({...common,options:{model:'bilinear-elastic-plastic',maxStrain:.01,minPoints:5,maxRelativeStandardError:.05}});
// @ts-expect-error Pair identities are required, not inferred by array position.
comparePrintedHoldoutPrediction({...common,specimenPairs:[{}],options:{model:'linear-elastic',maxStrain:.01,minPoints:5,maxRelativeStandardError:.05}});
