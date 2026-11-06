import type {PrintedSlsReportQuery,PrintedSlsReportArtifactResponse} from '../src/printed-sls-report-artifacts.js';
export interface PrintedSlsReportFileRequest {reportPath:string;expectedSHA256:string;query:PrintedSlsReportQuery;outputPath?:string}
export declare function readPrintedSlsReportArtifact(request:PrintedSlsReportFileRequest):Promise<PrintedSlsReportArtifactResponse&{publication?:{outputPath:string;outputBytes:number;outputSha256:string;cleanupWarning?:{code:string}}}>;
