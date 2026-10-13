export function validateHyperelastic(h){
 if(h===undefined)return;
 if(!h||h.model!=='neo-hookean-log'||Object.keys(h).some(k=>!['model','shearModulus','bulkModulus','testCurve','testConditions'].includes(k)))throw Error('Invalid hyperelastic model');
 const mu=h.shearModulus,K=h.bulkModulus;
 if(!(mu>0)||!Number.isFinite(mu)||!Number.isFinite(K)||K<2*mu/3||K/mu>20)throw Error('Neo-Hookean requires positive shear modulus and bulk/shear ratio between 2/3 and 20; near-incompressibility requires mixed elements');
 if(h.testConditions!==undefined&&(typeof h.testConditions!=='string'||h.testConditions.length>10000))throw Error('Invalid hyperelastic test conditions');
 if(h.testCurve!==undefined){if(!Array.isArray(h.testCurve)||h.testCurve.length<2||h.testCurve.length>200)throw Error('Hyperelastic test curve requires 2–200 rows');let last=0;for(const row of h.testCurve){if(!Array.isArray(row)||row.length!==2||!Number.isFinite(row[0])||row[0]<=last||!Number.isFinite(row[1]))throw Error('Hyperelastic curve rows are increasing positive stretch and nominal stress in Pa');last=row[0];}}
}

