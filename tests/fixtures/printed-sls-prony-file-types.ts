import {writePrintedSlsPronyReport,type SlsPronyFileRequest} from '../../scripts/printed-sls-prony-file-service.mjs';
const r:SlsPronyFileRequest={config:'C:/config.json',configSha256:'0'.repeat(64),output:'C:/report.json'};
writePrintedSlsPronyReport(r,{signal:new AbortController().signal}).then(s=>{const calibrated:false=s.calibrated;void calibrated;const exited:boolean|null=s.execution.exitConfirmed;void exited;
// @ts-expect-error stdout/service summary does not include raw curves
s.result;});
// @ts-expect-error the configuration raw SHA is required
const unpinned:SlsPronyFileRequest={config:'C:/config.json',output:'C:/report.json'};void unpinned;
