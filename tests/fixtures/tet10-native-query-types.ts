import {prepareNativeTet10Result,sampleNativeTet10Result} from '../../src/tet10-native-result.js';
import {queryNativeTet10File} from '../../scripts/tet10-native-file.mjs';
async function check(saved:unknown){const h=await prepareNativeTet10Result(saved),p=sampleNativeTet10Result(h,[1,2,3]);const unit:'Pa'=p.units.stress;void unit;
// @ts-expect-error issued handles are opaque, not cloneable plain records
sampleNativeTet10Result({kind:'validated-native-Tet10',validationVersion:1,nativeResultRevision:'x',nodeCount:10,elementCount:1,provisional:true},[1,2,3]);
// @ts-expect-error exactly three point coordinates
sampleNativeTet10Result(h,[1,2]);
await queryNativeTet10File({path:'x',expectedRawSHA256:'a',pointMm:[1,2,3]});
// @ts-expect-error expected raw-byte identity is mandatory
await queryNativeTet10File({path:'x',pointMm:[1,2,3]});}
void check;
