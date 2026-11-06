import {runPrintedSlsPronyRoundtrip, type PrintedSlsPronyInput} from '../../src/printed-sls-prony-roundtrip.js';
const input:PrintedSlsPronyInput={rawTraining:'{}',rawValidation:'{}',options:{model:'sls-relaxation',maxStrain:.01,minPoints:5,maxRelativeStandardError:.05,holdStrainTolerance:1e-6},specimenPairs:[{trainingSpecimenId:'T',validationSpecimenId:'V'}],bulkModulusPa:1e9,rampDurationSeconds:1e-4};
runPrintedSlsPronyRoundtrip(input,{signal:new AbortController().signal}).then(r=>{const calibrated:false=r.calibrated;void calibrated;for(const p of r.pairs)if(p.status==='compared'){const stress:number=p.validation.rows[0].pronyNominalStressPa;void stress;}});
// @ts-expect-error Young relaxation cannot be mapped without an explicit bulk modulus
const missing:PrintedSlsPronyInput={rawTraining:'{}',rawValidation:'{}',options:input.options,specimenPairs:[],rampDurationSeconds:.001};void missing;
