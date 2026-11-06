import {createPrintedMeasurementUi} from '../../src/ui/printed-measurement-ui.js';
const ui=createPrintedMeasurementUi({host:document.createElement('div'),language:()=> 'ja'});
ui.inspect().then(valid=>{const result:boolean=valid;void result;});
const phase:'idle'|'pending'|'valid'|'invalid'|'closed'=ui.snapshot().phase;void phase;
// @ts-expect-error this inspector cannot apply material properties
ui.applyMaterial();

ui.identification.identify().then((identified:boolean)=>void identified);
const digest:boolean=ui.identification.snapshot().digestPending;void digest;
// @ts-expect-error no application API on identification results
ui.identification.applyMaterial();

import type {PrintedIdentificationWorkerRequest} from '../../src/ui/printed-identification-ui.js';
const request:PrintedIdentificationWorkerRequest={requestId:1,raw:'{}',options:{model:'linear-elastic',maxStrain:.01,minPoints:3,maxRelativeStandardError:.1}};void request;

import {printedIdentificationExample} from '../../src/printed-identification-examples.js';
const toy=printedIdentificationExample('sls-relaxation');const rawToy:string=toy.raw;void rawToy;
ui.identification.exampleButtons[0].click();

import {identifyPrintedParametersByCondition} from '../../src/printed-identification-groups.js';
identifyPrintedParametersByCondition('{}',{model:'linear-elastic',maxStrain:.01,minPoints:3,maxRelativeStandardError:.1}).then(r=>{const unknownSd:number|null=r.grouping.groups[0].statistics!.youngsModulusPa.sampleStandardDeviation;void unknownSd;});
