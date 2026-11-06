import {createPrintedSlsReportArtifact,type PrintedSlsReportQuery} from '../../src/printed-sls-report-artifacts.js';
import {readPrintedSlsReportArtifact,type PrintedSlsReportFileRequest} from '../../scripts/printed-sls-report-artifact-service.mjs';
const query:PrintedSlsReportQuery={pairIndex:0,role:'validation',format:'svg',offset:0,limit:50};
createPrintedSlsReportArtifact({rawReport:'{}',expectedSHA256:'0'.repeat(64),query}).then(r=>{const next:number|null=r.page.nextOffset;const sha:string=r.artifact.sha256;void next;void sha;});
readPrintedSlsReportArtifact({reportPath:'C:/report.json',expectedSHA256:'0'.repeat(64),query,outputPath:'C:/new.svg'}).then(r=>{const n:number=r.publication!.outputBytes;void n;});
// @ts-expect-error report hash must be supplied
const unpinned:PrintedSlsReportFileRequest={reportPath:'C:/report.json',query};void unpinned;
