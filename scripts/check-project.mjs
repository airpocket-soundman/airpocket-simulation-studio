import {readFile} from 'node:fs/promises';
import {createStudioApi} from '../src/studio-api.js';
try {
 if(!process.argv[2])throw Error('Usage: npm run check:project -- path/to/project.json');
 const api=createStudioApi();api.loadProject(JSON.parse(await readFile(process.argv[2],'utf8')));
 console.log(JSON.stringify(api.getSummary(),null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
