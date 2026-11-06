import type {NativeTet10Point} from '../src/tet10-native-result.js';
export interface NativeTet10FileRequest {readonly path:string;readonly expectedRawSHA256:string;readonly pointMm:readonly [number,number,number]}
export interface NativeTet10FilePoint {readonly schemaVersion:1;readonly kind:'native-tet10-point-file';readonly source:{readonly bytes:number;readonly sha256:string};readonly measurement:NativeTet10Point}
/** Strict bounded duplicate-key parser; not a public project importer. */
export declare function parseNativeTet10Json(text:string):unknown;
/** Read-only pinned saved-file query. No output files or workers are created. */
export declare function queryNativeTet10File(request:NativeTet10FileRequest):Promise<NativeTet10FilePoint>;
