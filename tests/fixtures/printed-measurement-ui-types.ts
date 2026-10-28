import {createPrintedMeasurementUi} from '../../src/ui/printed-measurement-ui.js';
const ui=createPrintedMeasurementUi({host:document.createElement('div'),language:()=> 'ja'});
ui.inspect().then(valid=>{const result:boolean=valid;void result;});
const phase:'idle'|'pending'|'valid'|'invalid'|'closed'=ui.snapshot().phase;void phase;
// @ts-expect-error this inspector cannot apply material properties
ui.applyMaterial();
