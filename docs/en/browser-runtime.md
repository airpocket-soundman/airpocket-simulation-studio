# Browser execution and GitHub Pages

[日本語](../browser-runtime.md)

Deploy a static application through GitHub Actions to Pages. Check repository-relative URLs, Worker/WASM assets, MIME types and HTTPS on the deployed site. Models remain in the browser; save/restore through local project files, with local storage used for notes/preferences.

Use Workers to keep the interface responsive. Start with single-threaded WASM. Moving a calculation to a Worker does not itself make the solver multicore. Multithreaded WASM requires SharedArrayBuffer/cross-origin isolation; do not assume Pages allows custom COOP/COEP response headers. Any Service Worker workaround must be validated for reload/cache/compatibility, and a single-threaded fallback remains necessary.

Native OSS solvers require a WASM port or a separate browser engine. Check toolchains/dependencies, filesystem assumptions, memory and licenses. Adoption gates: reproducible licensed build → small Worker example → reference/convergence checks → cancellation/failure handling → Pages execution → public capability listing.

WebGPU calculations require dedicated compute implementations and numerical validation; compiling CPU code to WASM does not provide GPU acceleration. Do not assume native-style double precision. Detect available adapters/APIs and retain CPU fallback. Measure supported model sizes rather than promising large nonlinear/CFD/broadband cases.

The source repository is now public by explicit owner authorization because the account plan did not support Pages from a private repository. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Emscripten threads](https://emscripten.org/docs/porting/pthreads), [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).
