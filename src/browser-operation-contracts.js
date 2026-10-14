import {browserMethods} from './browser-operation-names.js';
import {inputOperationContracts} from './browser-operation-input-contracts.js';
import {viewOperationContracts} from './browser-operation-view-contracts.js';
import {archiveOperationContracts} from './browser-operation-archive-contracts.js';
import {jobOperationContracts} from './browser-operation-job-contracts.js';

const groups=[inputOperationContracts,viewOperationContracts,archiveOperationContracts,jobOperationContracts];
const registry={};for(const group of groups)for(const [method,contract]of Object.entries(group)){if(registry[method]||!Object.hasOwn(browserMethods,method))throw Error('Invalid browser operation contract: '+method);registry[method]={method,scope:browserMethods[method],...contract};}
if(Object.keys(registry).length!==Object.keys(browserMethods).length)throw Error('Incomplete browser operation contracts');
const fail=()=>Object.assign(new TypeError('Invalid browser operation contract query'),{code:'BROWSER_CONTRACT_QUERY_INVALID'});
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
export const browserContractVersion=1;
/** Declarations only: this does not grant a session, run a command or bypass adapter validation. */
export function getBrowserOperationContracts(query={}){
 if(!query||typeof query!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(query))||Reflect.ownKeys(query).some(key=>typeof key!=='string'||!['method','scope','offset','limit'].includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(query,key),'value')))throw fail();
 const {method,scope,offset=0,limit=5}=query;
 if(method!==undefined&&(typeof method!=='string'||!Object.hasOwn(browserMethods,method))||scope!==undefined&&!['inspect','edit','analyze','view'].includes(scope)||!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>10)throw fail();
 const matching=Object.keys(browserMethods).filter(name=>(method===undefined||method===name)&&(scope===undefined||scope===browserMethods[name]));
 if(offset>matching.length)throw fail();
 const response={schemaVersion:1,contractVersion:browserContractVersion,target:'browser',declarationOnly:true,schemaDialect:'https://json-schema.org/draft/2020-12/schema',inputSchemaCoverage:'Command envelopes and documented nested fields; adapter, revision, applicability and physical validation remain authoritative.',requiresBrowserGrant:true,maxPageBytes:65536,total:matching.length,offset,limit,nextOffset:null,operations:[]};
 for(const name of matching.slice(offset,offset+limit)){response.operations.push(structuredClone(registry[name]));if(bytes(response)>65000){response.operations.pop();break;}}
 if(!response.operations.length&&offset<matching.length)throw Error('Browser operation contract exceeds page budget');
 if(offset+response.operations.length<matching.length)response.nextOffset=offset+response.operations.length;
 return response;
}
