import {createResultExportPreparation} from '../../src/result-export-preparation.js';
const adapter=createResultExportPreparation({captureSelection:()=>()=>true,getAnalysis:()=>({result:{kind:'thermal'}}),isBusy:()=>false,getResultView:async()=>({resultRevision:'sha256:example',state:{field:'temperature'}}),getSetupView:()=>({}),getLanguage:()=> 'en',preflight:()=>{},render:args=>new Blob([String(args.signal?.aborted)])});
adapter.prepare({format:'png'}).then(value=>{const revision:string=value.resultRevision;adapter.render({expectedResultRevision:revision});});
adapter.cancel();adapter.dispose();const busy:boolean=adapter.isBusy();void busy;
// @ts-expect-error the render handoff requires the inspected result revision
adapter.render({format:'png'});
// @ts-expect-error renderer cancellation uses AbortSignal, not string controls
adapter.render({expectedResultRevision:'sha256:example',signal:'cancel'});
