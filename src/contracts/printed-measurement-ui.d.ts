export interface PrintedMeasurementUiSnapshot {phase:'idle'|'pending'|'valid'|'invalid'|'closed';sourceSha256:string|null;selectedSpecimenId:string|null;specimenCount:number;sampleCount:number;page:number;chartPoints:number;canDownload:boolean;}
export interface PrintedMeasurementUi {
 panel:HTMLDetailsElement;input:HTMLTextAreaElement;run:HTMLButtonElement;example:HTMLButtonElement;status:HTMLParagraphElement;results:HTMLDivElement;downloads:HTMLDivElement;
 inspect():Promise<boolean>;invalidate():void;refresh():void;snapshot():PrintedMeasurementUiSnapshot;destroy():void;
}
export declare const PRINTED_MEASUREMENT_VIEW_LIMITS:Readonly<{chartPoints:201;tableRows:50}>;
export declare function syntheticPrintedMeasurementJson():string;
export declare function createPrintedMeasurementUi(options:{host:HTMLElement;document?:Document;language?:()=>string;url?:{createObjectURL(blob:Blob):string;revokeObjectURL(url:string):void}}):PrintedMeasurementUi;
