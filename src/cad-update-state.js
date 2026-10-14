const reasons=['missing-face','ambiguous-face','partial-selection','changed-dimensions','unsupported-face'];
export function requireResolvedCadConditions(project){
 if(project.conditions?.some(c=>c.cadUpdateRequired))throw Error('Resolve CAD update regions before analysis');
}
export function validatePendingCadCondition(condition,validate){
 const p=condition.cadUpdateRequired;
 if(!p||p.version!==1||!reasons.includes(p.reason)||!Number.isFinite(p.previousAreaMm2)||p.previousAreaMm2<=0||!Array.isArray(p.faces)||!p.faces.length||p.faces.length>2000||p.faces.some(f=>!Number.isInteger(f.mesh)||f.mesh<0||!Number.isInteger(f.faceId)||f.faceId<0)||p.previousDimensions!==undefined&&(typeof p.previousDimensions!=='string'||p.previousDimensions.length>8000)||!Array.isArray(condition.regions)||condition.regions.length||condition.planarRegion||condition.cylindricalRegion)throw Error('Invalid unresolved CAD condition');
 const definition=structuredClone(condition);delete definition.cadUpdateRequired;
 definition.regions=condition.type==='thermalContact'?[{mesh:0,triangles:[0]},{mesh:1,triangles:[0]}]:[{mesh:0,triangles:[0]}];
 validate({version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]},{positions:[0,0,1,1,0,1,0,1,1],faceIds:[0]}],conditions:[definition]});
}
