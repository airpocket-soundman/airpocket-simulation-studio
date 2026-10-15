// Study/adaptive/internal-domain form helpers: read and write plain input values by id.
// Every dependency is injected; this module imports nothing.
const AXES=['x','y','z'];
export function createStudyFormUi({$,browserStudyControls}){
 function readBrowserStudyControls(){return Object.fromEntries(Object.entries(browserStudyControls).map(([id,descriptor])=>[id,descriptor.type==='checkbox'?$(id).checked:$(id).value]));}
 function writeBrowserStudyControls(values){for(const [id,descriptor]of Object.entries(browserStudyControls)){if(descriptor.type==='checkbox')$(id).checked=values[id];else $(id).value=values[id];}}
 function restoreAdaptiveOptions(o){$('adaptive-elements').value=o.maxAdaptiveElements??10000;$('adaptive-seconds').value=o.maxAdaptiveSeconds??60;$('adaptive-tolerance').value=(o.tolerance??.01)*100;$('adaptive-stress-tolerance').value=(o.stressTolerance??.05)*100;}
 function internalOptions(){return {enclosure:[...AXES.map(k=>Number($('internal-min-'+k).value)),...AXES.map(k=>Number($('internal-width-'+k).value))],seedPoint:AXES.map(k=>Number($('internal-seed-'+k).value)),portPlanes:[0,1,2,3,4,5].filter(i=>$('internal-port-'+i).checked)};}
 function restoreInternalFields(s){AXES.forEach((k,i)=>{$('internal-min-'+k).value=s.enclosure[i];$('internal-width-'+k).value=s.enclosure[i+3];$('internal-seed-'+k).value=s.seedPoint[i];});for(let i=0;i<6;i++)$('internal-port-'+i).checked=s.portPlanes.includes(i);}
 return {readBrowserStudyControls,writeBrowserStudyControls,restoreAdaptiveOptions,internalOptions,restoreInternalFields};
}
