export function validatePlasticity(p){
 if(p===undefined)return;
 if(!p||typeof p!=='object'||Array.isArray(p)||p.model!=='j2-isotropic'||Object.keys(p).some(k=>!['model','yieldStress','hardeningModulus','testConditions'].includes(k)))throw Error('Invalid plasticity model');
 if(!Number.isFinite(p.yieldStress)||p.yieldStress<=0||!Number.isFinite(p.hardeningModulus)||p.hardeningModulus<=0)throw Error('J2 plasticity requires positive yield stress and isotropic hardening modulus in Pa');
 if(p.testConditions!==undefined&&(typeof p.testConditions!=='string'||p.testConditions.length>10000))throw Error('Invalid plasticity test conditions');
}
