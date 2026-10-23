import {createChannelNodeVelocityPolicy,CHANNEL_NODE_VELOCITY_POLICY,type ChannelNodeVelocityPolicyOptions} from '../../src/channel-node-velocity-policy.js';
declare const options:ChannelNodeVelocityPolicyOptions;
createChannelNodeVelocityPolicy({...options,policy:CHANNEL_NODE_VELOCITY_POLICY}).then(result=>{const component:number|null=result.nodes[0].velocityMps[0];const scope:false=result.scope.solverConnected;void component;void scope;
 // @ts-expect-error outlet pressure is not assigned to nodes
 result.nodes[0].pressurePa;
});
// @ts-expect-error explicit supported policy required
createChannelNodeVelocityPolicy({...options,policy:'automatic'});
