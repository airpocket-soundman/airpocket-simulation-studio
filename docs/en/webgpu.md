# WebGPU computation (structural, experimental)

[日本語](../webgpu.md)

Select WebGPU + CPU correction for sparse matrix-vector products in linear structure using a compute shader. CSR coefficients and inputs/outputs use float32. PCG vector updates and dot products remain on CPU, as do meshing, assembly and postprocessing. This is not a fully GPU-resident solver.

Check the initial approximation against the original float64 matrix. Residual above 1% triggers CPU fallback. WASM CPU correction must yield a free-DOF residual at most 2e-8. Missing devices, initialization/buffer errors, nonconvergence or failed precision checks return a CPU solution with the fallback reason. GPU initialization has an 8-second deadline; the entire worker has a 120-second deadline. A whole-worker timeout cancels without returning a result.

An actual Intel GPU verified 0.04 mm / 100 N, pressure/gravity 0.040008 mm / 100.04 N, local-frame prescribed displacement with ±100 N, and 428→737→1156-element adaptation. Final free-DOF residuals were around 1e-9 or below. Saved GPU results retain backend, verification and timing without recalculation.

The small prescribed-displacement example took 723.7 ms through the GPU path versus 49.2 ms on WASM CPU. Setup, transfer and correction mean speedup is not guaranteed; WASM CPU remains default. Thermal, acoustic and fluid GPU paths are unsupported and unselectable. Broader browser/model-size performance characterization remains PERF1 work.

`analysisApi.checkGpuEnvironment()` reports availability, hardware/software adapter and buffer limits. A paired browser also exposes the same live browser probe as the inspect-scoped `checkGpuEnvironment` operation. Its runtime observation is separate from the operation declaration and must not be confused with Node GPU capability. `analysisApi.analyze({method:'webgpu-pcg'})` executes the same path. Node tests verify CSR packing, float32 approximation, CPU correction/fallback and the canonical worker fallback. Actual WGSL compute was checked separately in the browser; Node tests are not hardware GPU verification.

API reference: [W3C WebGPU specification](https://www.w3.org/TR/webgpu/).
