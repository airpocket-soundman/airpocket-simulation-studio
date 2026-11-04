import {channelShearFluid,runShearPlateCoupled,shearPlateMonolithicReference,SHEAR_PLATE_LIMITS} from '../../src/fsi-channel-shear-plate.js';
const fluid=channelShearFluid({cellsY:4,height:1,density:2,kinematicViscosity:.1});
const reconstructed=channelShearFluid(fluid.parameters);
const r=runShearPlateCoupled({fluid:reconstructed,plate:{mass:1,stiffness:2},initialProfile:[.1,.2,.1,0],dt:.01,steps:3});
if(r.converged){const energy:number=r.history[1].energyDefectJPerM2;const state:Float64Array=r.profile;void energy;void state;}
else{const partial:number=r.failedStep;void partial;
 // @ts-expect-error failed partial marches have no completed profile
 r.profile;
}
shearPlateMonolithicReference({fluid,plate:{mass:1,stiffness:2},initialProfile:[.1,.2,.1,0],endTime:1,h:.001});
const maxSteps:20000=SHEAR_PLATE_LIMITS.coupledSteps;void maxSteps;
// @ts-expect-error fluid snapshot is immutable
fluid.parameters.density=0;
// @ts-expect-error saved parameters do not restore issued executable methods
runShearPlateCoupled({fluid:fluid.parameters,plate:{mass:1,stiffness:2},dt:.01,steps:1});
// @ts-expect-error state cannot override the internal Newmark state
runShearPlateCoupled({fluid,plate:{mass:1,stiffness:2},dt:.01,steps:1,state:{d:[9]}});
