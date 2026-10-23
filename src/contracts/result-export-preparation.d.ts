export interface ResultExportPreparationRequest {format?:string;expectedResultRevision?:string;[key:string]:unknown;}
export interface ResultExportRenderRequest extends ResultExportPreparationRequest {expectedResultRevision:string;signal?:AbortSignal;}
export interface ResultExportViewSnapshot {resultRevision:string;physicalRevision?:string;state:Record<string,unknown>;physicalTimeSeconds?:number;}
export interface PreparedResultExport {resultRevision:string;physicalRevision?:string;view:{result:Record<string,unknown>;setup:Record<string,unknown>;language:string};}
export interface ResultExportPreparationAdapter {
 captureSelection:()=>()=>boolean;
 getAnalysis:()=>{result?:{kind?:string}}|null;
 isBusy:()=>boolean;
 getResultView:()=>Promise<ResultExportViewSnapshot>;
 getSetupView:()=>Record<string,unknown>;
 getLanguage:()=>string;
 preflight:(request:ResultExportPreparationRequest)=>unknown;
 render:(request:ResultExportRenderRequest)=>Blob|Promise<Blob>;
}
export interface ResultExportPreparation {
 prepare(request:ResultExportPreparationRequest):Promise<PreparedResultExport>;
 render(request:ResultExportRenderRequest):Promise<Blob>;
 cancel():void;
 dispose():void;
 isBusy():boolean;
}
export declare function createResultExportPreparation(adapter:ResultExportPreparationAdapter):ResultExportPreparation;
