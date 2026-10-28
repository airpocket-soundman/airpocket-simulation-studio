import {createResultSelectionState,type ResultSelectionState} from '../../src/result-selection-state.js';
const selection:ResultSelectionState=createResultSelectionState();
const guard:()=>boolean=selection.capture();
const valid:boolean=guard();selection.invalidate();selection.dispose();
// @ts-expect-error capture does not expose a numeric/persistable selection id
const saved:number=selection.capture();
// @ts-expect-error generations carry no result payload or user-selected index
selection.invalidate({caseId:'a'});
void [valid,saved];
