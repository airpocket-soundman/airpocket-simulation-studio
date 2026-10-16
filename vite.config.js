import { defineConfig } from 'vite';
import {collectSourceBuildIdentity} from './scripts/source-build-identity.mjs';
export default defineConfig(async({command})=>({ define:{__AIRPOCKET_BUILD_IDENTITY__:JSON.stringify(command==='build'?await collectSourceBuildIdentity():{status:'unavailable'})}, base: './', server:{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}}, build: {rollupOptions:{input:{app:'index.html',development:'development.html'}}} }));
