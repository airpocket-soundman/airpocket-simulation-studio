import {AcpSessionClient} from '../../scripts/acp-session-client.mjs';
const client=new AcpSessionClient({executable:'/synthetic/node',argv:[],cwd:'/synthetic'});
const state:string=client.describe().state;
const result:Promise<{text:string;cancelled:boolean}>=client.prompt('synthetic');
// @ts-expect-error text-only prompt contract
client.prompt({text:'unsupported'});
// @ts-expect-error no implicit PATH process discovery
new AcpSessionClient({argv:[],cwd:'/synthetic'});
void state;void result;
