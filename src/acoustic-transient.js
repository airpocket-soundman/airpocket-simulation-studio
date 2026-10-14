import {elementGeometry} from './fem-core.js';
import {sampleResult} from './probe.js';
import {sphericalOuterFaces} from './acoustic-radiation.js';

export function validateTransientAcousticStudy(s){
 if(s.acousticTransient!==undefined&&typeof s.acousticTransient!=='boolean')throw Error('Invalid transient acoustic setting');
 if(!s.acousticTransient)return;
 if(s.kind!=='acoustic'||s.sweep||s.directivityEnabled||s.lossFactor!==undefined&&s.lossFactor!==0)throw Error('Transient acoustics requires zero harmonic loss and no frequency sweep or far-field calculation');
 for(const [key,min,max] of [['acousticDuration',1e-6,.1],['pulseWidth',1e-6,.01],['acousticTimeStep',0,.01],['dampingRate',0,1e6]])if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<min||s[key]>max))throw Error('Invalid transient acoustic parameter: '+key);
}

export function pressurePulse(time,frequency,width){
 if(time<=0||time>=12*width*(1-1e-14))return 0;
 const q=(time-6*width)/width;return Math.cos(2*Math.PI*frequency*(time-6*width))*Math.exp(-.5*q*q);
}

/** Lumped Tet4 mass, central differences, diagonal passive damping.
 * dt <= 0.9*2/sqrt(Gershgorin bound of M^-1 K). Coordinates are mm, time seconds.
 * The stored receiver is physical pressure; playback normalization is separate.
 */
export function solveAcousticTransient(mesh,boundary,study={},options={}){
 validateTransientAcousticStudy({...study,kind:'acoustic',acousticTransient:true});
 const {frequency=4000,soundSpeed=343,airDensity=1.2,acousticDuration:duration=.004,pulseWidth:width=.0002,dampingRate=0,acousticTimeStep:requested=0,receiverPoint=[5,5,20],radiationBoundary}=study;
 if(![frequency,soundSpeed,airDensity].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid transient acoustic medium');
 const n=mesh.nodes.length/3;if(!Number.isInteger(n)||n<4||n>3000||!mesh.tetrahedra.length||mesh.tetrahedra.length>10000)throw Error('Transient acoustic prototype limit: 3000 nodes / 10000 tetrahedra');
 if(duration<12*width*(1-1e-14))throw Error('Transient duration must include the complete 12-width pulse');
 const M=new Float64Array(n),D=new Float64Array(n),rowBound=new Float64Array(n),entries=[];let maxEdgeMm=0;
 for(const t of mesh.tetrahedra){const g=elementGeometry(mesh,t),k=new Float64Array(16);for(let i=0;i<4;i++){M[t[i]]+=g.volume/(4*airDensity*soundSpeed**2);for(let j=0;j<4;j++){k[i*4+j]=g.volume/airDensity*g.grad[i].reduce((s,v,a)=>s+v*g.grad[j][a],0);rowBound[t[i]]+=Math.abs(k[i*4+j]);if(j>i)maxEdgeMm=Math.max(maxEdgeMm,Math.hypot(...[0,1,2].map(a=>mesh.nodes[3*t[i]+a]-mesh.nodes[3*t[j]+a])));}}entries.push({ids:t,k});}
 const bandwidthHz=frequency+3/(2*Math.PI*width),wavelengthMm=soundSpeed/bandwidthHz*1000;
 if(!(maxEdgeMm>0)||maxEdgeMm>wavelengthMm/6)throw Error('Transient acoustic mesh edge exceeds one sixth of the three-sigma pulse bandwidth wavelength');
 const fixed=new Map();for(const [i,value] of boundary.acousticPressures||[]){if(!Number.isInteger(i)||i<0||i>=n||!Number.isFinite(value))throw Error('Invalid transient prescribed pressure');if(fixed.has(i)&&fixed.get(i)!==value)throw Error('Conflicting transient source pressure');fixed.set(i,value);}
 if(!fixed.size&&!options.initialPressure)throw Error('Specify a transient pressure source');
 const outer=radiationBoundary?sphericalOuterFaces(mesh,radiationBoundary):[],outerNodes=new Set(outer.flatMap(f=>f.nodes));
 if([...fixed.keys()].some(i=>outerNodes.has(i))||(boundary.impedance||[]).some(f=>f.nodes.some(i=>outerNodes.has(i))))throw Error('Transient radiation cannot overlap pressure or impedance');
 for(const f of boundary.impedance||[]){if(f.impedanceTable||f.reactance||!(f.value>0)||!Number.isFinite(f.value)||!(f.areaM2>0)||!Number.isFinite(f.areaM2)||f.nodes.length!==3||!f.nodes.every(i=>Number.isInteger(i)&&i>=0&&i<n))throw Error('Transient impedance must be positive, real and constant');for(const i of f.nodes)D[i]+=f.areaM2/(3*f.value);}
 for(const f of outer){const k=new Float64Array(9);for(let a=0;a<3;a++){const i=f.nodes[a],stiff=f.areaM2/(3*airDensity*radiationBoundary.radiusMm*.001);k[4*a]=stiff;rowBound[i]+=stiff;D[i]+=f.areaM2/(3*airDensity*soundSpeed);}entries.push({ids:f.nodes,k});}
 let bound=0;for(let i=0;i<n;i++){if(!(M[i]>0)||!Number.isFinite(M[i]))throw Error('Invalid transient acoustic mass');D[i]+=2*dampingRate*M[i];bound=Math.max(bound,rowBound[i]/M[i]);}
 const stableTimeStep=.9*2/Math.sqrt(bound);if(!(stableTimeStep>0)||!Number.isFinite(stableTimeStep))throw Error('Invalid acoustic stability bound');
 if(requested>stableTimeStep*(1+1e-12))throw Error('Requested acoustic time step exceeds the conservative stability bound');
 const steps=Math.ceil(duration/(requested||stableTimeStep));if(steps>60000||steps*n>60000000)throw Error('Transient acoustic workload limit exceeded; shorten duration or reduce mesh size');const dt=duration/steps;
 const apply=options.matvecFactory?options.matvecFactory(entries,n):x=>{const out=new Float64Array(n);for(const {ids,k}of entries)for(let i=0;i<ids.length;i++)for(let j=0;j<ids.length;j++)out[ids[i]]+=k[i*ids.length+j]*x[ids[j]];return out;};
 let p=new Float64Array(n);if(options.initialPressure){if(options.initialPressure.length!==n||!Array.from(options.initialPressure).every(Number.isFinite))throw Error('Invalid initial pressure');p.set(options.initialPressure);}
 // Zero initial velocity: p(-dt)=p(0)+dt^2/2 * acceleration(0).
 const kp=apply(p),old=Float64Array.from(p,(v,i)=>v-.5*dt*dt*kp[i]/M[i]);for(const i of fixed.keys()){p[i]=0;old[i]=0;}
 const probe=sampleResult(mesh,{kind:'acousticTransient',pressure:Array.from(p),time:0},receiverPoint),tet=mesh.tetrahedra[probe.element];
 const receive=()=>tet.reduce((s,i,a)=>s+probe.weights[a]*p[i],0),receiverPressurePa=[receive()],snapshots=[{time:0,pressure:Array.from(p)}],stride=Math.max(1,Math.ceil(steps/60));
 let previous=old,maxPressurePa=p.reduce((s,v)=>Math.max(s,Math.abs(v)),0),sumSquares=.5*receive()**2;
 for(let step=1;step<=steps;step++){const action=apply(p),next=new Float64Array(n),time=step*dt,pulse=pressurePulse(time,frequency,width);for(let i=0;i<n;i++){next[i]=fixed.has(i)?fixed.get(i)*pulse:(2*M[i]*p[i]-(M[i]-dt*D[i]/2)*previous[i]-dt*dt*action[i])/(M[i]+dt*D[i]/2);if(!Number.isFinite(next[i]))throw Error('Non-finite transient pressure');maxPressurePa=Math.max(maxPressurePa,Math.abs(next[i]));}previous=p;p=next;const v=receive();receiverPressurePa.push(v);sumSquares+=(step===steps?.5:1)*v*v;if(step%stride===0||step===steps){snapshots.push({time,pressure:Array.from(p)});options.onObserve?.({stage:'time-step',kind:'acousticTransient',step,steps,time,timeUnit:'s',converged:null,metrics:{receiverPressurePa:v,maxPressurePa},field:{kind:'acousticTransient',time,pressure:Array.from(p),units:{pressure:'Pa'}}});}if(step%Math.max(1,Math.ceil(steps/10))===0)options.onProgress?.(`Transient acoustics ${step}/${steps}`);}
 return {kind:'acousticTransient',engine:options.matvecFactory?'Airpocket Wave Tet4 / WASM CPU':'Airpocket Wave Tet4 / JavaScript CPU',pressure:Array.from(p),time:duration,duration,timeStep:dt,stableTimeStep,steps,frequency,pulseWidth:width,dampingRate,maxPressurePa,receiverPoint:[...receiverPoint],receiverPressurePa,receiverPeakPa:receiverPressurePa.reduce((s,v)=>Math.max(s,Math.abs(v)),0),receiverRmsPa:Math.sqrt(sumSquares/steps),snapshots,bandwidthHz,wavelengthMm,maxEdgeMm,amplitudeConvention:'instantaneous signed pressure; receiver RMS over the full record',boundaryModel:outer.length?'first-order spherical radiation':'rigid walls / real passive impedance'};
}
