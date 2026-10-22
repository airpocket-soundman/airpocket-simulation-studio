// Fixed Re40 O-grid QA only: nodal farfield quadrature, not discrete SU2 flux.
import {readFileSync} from 'node:fs';
import {parseSu2Vtu} from '../src/su2-vtu.js';
const mesh = parseSu2Vtu(readFileSync(process.argv[2]));
const radius = Number(process.argv[3]);
if (![50.5, 100.5].includes(radius)) throw Error('Only fixed QA domain radii allowed');
const boundary = [];
for (let i = 0; i < mesh.pointCount; i++) {
  const [x, y] = mesh.points.slice(i * 3, i * 3 + 2);
  if (Math.abs(Math.hypot(x, y) - radius) <= radius * 1e-6) {
    boundary.push({x, y, angle: Math.atan2(y, x), u: mesh.fields.Velocity.values[i * 3], v: mesh.fields.Velocity.values[i * 3 + 1]});
  }
}
if (![64, 128].includes(boundary.length)) throw Error(`Unexpected farfield vertex count: ${boundary.length}`);
boundary.sort((a, b) => a.angle - b.angle);
let outward = 0, inward = 0;
for (let i = 0; i < boundary.length; i++) {
  const a = boundary[i], b = boundary[(i + 1) % boundary.length];
  const flux = (a.u + b.u) / 2 * (b.y - a.y) - (a.v + b.v) / 2 * (b.x - a.x);
  if (flux >= 0) outward += flux; else inward -= flux;
}
console.log(JSON.stringify({method: 'nodal-trapezoid-outer-boundary', discreteSolverFlux: false, densityKgM3: 1, unit: 'kg/(s*m span)', vertices: boundary.length, outward, inward, net: outward - inward, relativeImbalance: Math.abs(outward - inward) / Math.max(outward, inward)}));
